import { Injectable, Logger } from '@nestjs/common';
import { appendFileSync, openSync, writeSync, closeSync, writeFileSync, unlinkSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ensureDefaultPaymentMethods } from '../payment-methods/ensure-default-payment-methods';

/** Payload shape from `OrdersService` list/detail mapping (§9c). */
export type OrderPrintPayload = {
  id: string;
  sequence: number;
  orderNumber: string;
  createdAt: string;
  employeeName: string | null;
  lines: Array<{
    menuItemName: string;
    quantity: number;
    basePrice: number;
    addOns: Array<{ optionId: string; optionName: string; price: number }>;
  }>;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: string;
  paymentMethodDetail: string | null;
  tenderCents: number | null;
  changeDueCents: number | null;
  status: string;
};

type CompanyPrintHeader = {
  companyName: string | null;
  registerNumber: string | null;
  address: string | null;
  contactNumber: string | null;
  email: string | null;
};

type PaymentMethodRow = { code: string; label: string };

const INIT = Buffer.from([0x1b, 0x40]);

/** ESC/POS alignment & emphasis (sample receipt layout). */
const ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);
const BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);
const SIZE_NORMAL = Buffer.from([0x1d, 0x21, 0x00]);

/** ESC/POS: print and feed `n` lines (0–255). */
function escFeedLines(n: number): Buffer {
  const b = Math.max(0, Math.min(255, Math.round(n)));
  return Buffer.from([0x1b, 0x64, b]);
}

/** After receipt: minimal feed + partial cut (less blank paper before tear). */
function receiptEndSequence(): Buffer {
  return Buffer.concat([Buffer.from('\n', 'utf8'), escFeedLines(1), Buffer.from([0x1d, 0x56, 0x01])]);
}

/** Kitchen slip end: small feed + partial cut. */
function kitchenEndSequence(): Buffer {
  return Buffer.concat([Buffer.from('\n', 'utf8'), escFeedLines(1), Buffer.from([0x1d, 0x56, 0x01])]);
}

/** Start kitchen job: reset printer state (no extra top feed — gap is timed in software). */
function kitchenStartSequence(): Buffer {
  return Buffer.concat([INIT, ALIGN_LEFT, SIZE_NORMAL]);
}

/** 58mm Font A ≈ 32 cols (avoids `-----` wrapping); 80mm typically 48–56. */
const CHARS_PER_LINE: Record<58 | 80, number> = { 58: 32, 80: 56 };

/** Tear window before kitchen job (ms). Override: `THERMAL_KITCHEN_DELAY_MS`. */
const RECEIPT_TO_KITCHEN_SEND_GAP_MS = 800;

function slipTextSafe(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

function rmMoney(cents: number): string {
  return `RM ${(cents / 100).toFixed(2)}`;
}

function codeNorm(s: string): string {
  return s.trim().toLowerCase();
}

function findPaymentLabel(methods: PaymentMethodRow[], code: string): string | null {
  const k = codeNorm(code);
  const m = methods.find((x) => codeNorm(x.code) === k);
  return m?.label ?? null;
}

/** §9c `paymentLabel` — mirrors frontend `resolvePaymentMethodLabel` with server catalog. */
export function resolvePaymentMethodLabel(
  methods: PaymentMethodRow[],
  order: Pick<OrderPrintPayload, 'paymentMethod' | 'paymentMethodDetail'>,
): string {
  const detail = order.paymentMethodDetail?.trim();
  if (detail) {
    return findPaymentLabel(methods, detail) ?? detail;
  }
  const pm = order.paymentMethod?.trim();
  if (pm) {
    return findPaymentLabel(methods, pm) ?? pm;
  }
  return '—';
}

/** §9c `formatOrderDisplay`. */
export function formatOrderDisplay(o: Pick<OrderPrintPayload, 'id' | 'orderNumber' | 'sequence'>): string {
  const num = o.orderNumber?.trim();
  if (num) return num;
  if (Number.isFinite(o.sequence)) {
    return `C${String(o.sequence).padStart(3, '0')}`;
  }
  const hex = o.id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `C-${hex}`;
}

/** §9c `formatLineAddOnsSummary` — group by optionId, else optionName. */
export function formatLineAddOnsSummary(
  addOns: Array<{ optionId: string; optionName: string }>,
): string {
  if (!addOns.length) return '';
  const groups = new Map<string, { name: string; count: number }>();
  for (const a of addOns) {
    const key = (a.optionId?.trim() || a.optionName?.trim() || '_') || '_';
    const name = (a.optionName?.trim() || key).trim();
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { name, count: 1 });
  }
  const parts: string[] = [];
  for (const { name, count } of groups.values()) {
    parts.push(count > 1 ? `${name} ×${count}` : name);
  }
  return parts.join(', ');
}

function padLine(left: string, right: string, width: number): string {
  const L = slipTextSafe(left);
  const R = slipTextSafe(right);
  const maxLeft = Math.max(0, width - R.length - 1);
  const l = L.length > maxLeft ? `${L.slice(0, Math.max(0, maxLeft - 1))}…` : L;
  const spaces = Math.max(1, width - l.length - R.length);
  return `${l}${' '.repeat(spaces)}${R}`;
}

function wrapToWidth(text: string, width: number): string[] {
  const t = slipTextSafe(text);
  if (t.length <= width) return [t];
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    out.push(t.slice(i, i + width));
    i += width;
  }
  return out;
}

function rule(width: number): string {
  return '-'.repeat(width);
}

function normalizeDevicePath(p: string): string {
  const t = p.trim();
  if (!t) return t;
  if (/^\\\\\.\\COM\d+$/i.test(t)) return t;
  if (/^COM\d+$/i.test(t)) return `\\\\.\\${t.toUpperCase()}`;
  return t;
}

function concatBuffers(parts: Buffer[]): Buffer {
  return Buffer.concat(parts);
}

function slipBuffer(lines: string[]): Buffer {
  const body = lines.join('\n') + '\n';
  return Buffer.from(body, 'utf8');
}

function padLineBuf(left: string, right: string, width: number): Buffer {
  return Buffer.from(padLine(left, right, width) + '\n', 'utf8');
}

/** Bold label + normal value (e.g. `Order:` **C035**). */
function metaLineBuf(label: string, value: string): Buffer {
  return Buffer.concat([
    BOLD_ON,
    Buffer.from(label, 'utf8'),
    BOLD_OFF,
    Buffer.from(` ${slipTextSafe(value)}\n`, 'utf8'),
  ]);
}

/** Item row: bold `Nx` + item name, amount right; add-ons printed separately below. */
function receiptItemFirstRow(qtyPart: string, namePart: string, rhs: string, w: number): Buffer {
  const qp = slipTextSafe(qtyPart);
  const np = slipTextSafe(namePart);
  const r = slipTextSafe(rhs);
  const leftLen = qp.length + np.length;
  const spaces = w - leftLen - r.length;
  if (spaces >= 1) {
    return Buffer.concat([
      BOLD_ON,
      Buffer.from(qp, 'utf8'),
      BOLD_OFF,
      Buffer.from(`${np}${' '.repeat(spaces)}${r}\n`, 'utf8'),
    ]);
  }
  return Buffer.concat([
    BOLD_ON,
    Buffer.from(qp, 'utf8'),
    BOLD_OFF,
    Buffer.from(`${np}\n`, 'utf8'),
    padLineBuf('', r, w),
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** PowerShell: raw bytes to a named Windows queue (WinSpool RAW). */
const WIN_RAW_PRINT_PS1 = `
param(
  [Parameter(Mandatory=$true)][string]$BinPath,
  [Parameter(Mandatory=$true)][string]$NameB64,
  [Parameter(Mandatory=$true)][string]$DocTitleB64
)
$ErrorActionPreference = 'Stop'
$name = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($NameB64))
$docTitle = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($DocTitleB64))
$bytes = [System.IO.File]::ReadAllBytes($BinPath)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class PosRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
  }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO pDocInfo);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static void Send(string printer, byte[] data, string docTitle) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero))
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "OpenPrinter failed");
    try {
      var di = new DOCINFO { pDocName = docTitle, pOutputFile = null, pDatatype = "RAW" };
      if (!StartDocPrinter(h, 1, di))
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "StartDocPrinter failed");
      try {
        if (!StartPagePrinter(h))
          throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "StartPagePrinter failed");
        IntPtr p = Marshal.AllocCoTaskMem(data.Length);
        try {
          Marshal.Copy(data, 0, p, data.Length);
          int written;
          if (!WritePrinter(h, p, data.Length, out written) || written != data.Length)
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "WritePrinter failed");
        } finally {
          Marshal.FreeCoTaskMem(p);
        }
        if (!EndPagePrinter(h))
          throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "EndPagePrinter failed");
      } finally {
        EndDocPrinter(h);
      }
    } finally {
      ClosePrinter(h);
    }
  }
}
'@

[PosRawPrint]::Send($name, $bytes, $docTitle)
`.trim();

@Injectable()
export class ThermalPrintService {
  private readonly log = new Logger(ThermalPrintService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Width: `THERMAL_WIDTH_MM` env, else company `thermalPaperWidth`, else 80.
   */
  async resolveWidthMm(): Promise<58 | 80> {
    const env = process.env.THERMAL_WIDTH_MM?.trim();
    if (env === '58' || env === '80') return env === '58' ? 58 : 80;
    const row = await this.prisma.companySetting.findUnique({
      where: { id: 'default' },
      select: { thermalPaperWidth: true },
    });
    const w = row?.thermalPaperWidth?.trim();
    if (w === '58' || w === '80') return w === '58' ? 58 : 80;
    return 58;
  }

  /**
   * §9b: `company.thermalPrinterQueueName` (Settings), else `THERMAL_PRINTER_NAME`.
   */
  async resolvePrinterQueueName(): Promise<string | null> {
    const row = await this.prisma.companySetting.findUnique({
      where: { id: 'default' },
      select: { thermalPrinterQueueName: true },
    });
    const q = row?.thermalPrinterQueueName?.trim();
    if (q) return q;
    return process.env.THERMAL_PRINTER_NAME?.trim() || null;
  }

  private async loadCompanyHeader(): Promise<CompanyPrintHeader> {
    const row = await this.prisma.companySetting.findUnique({
      where: { id: 'default' },
      select: {
        companyName: true,
        registerNumber: true,
        address: true,
        contactNumber: true,
        email: true,
      },
    });
    if (!row) {
      return {
        companyName: null,
        registerNumber: null,
        address: null,
        contactNumber: null,
        email: null,
      };
    }
    return {
      companyName: row.companyName?.trim() || null,
      registerNumber: row.registerNumber?.trim() || null,
      address: row.address?.trim() || null,
      contactNumber: row.contactNumber?.trim() || null,
      email: row.email?.trim() || null,
    };
  }

  /**
   * Customer receipt — matches shop sample: centered header, dashed rules, bold meta labels,
   * `1x` item + indented `+` add-ons, thick rule before bold total, centered Thank you.
   */
  private buildReceipt(
    order: OrderPrintPayload,
    co: CompanyPrintHeader,
    widthMm: 58 | 80,
    paymentLabel: string,
  ): Buffer {
    const w = CHARS_PER_LINE[widthMm];
    const orderRef = formatOrderDisplay(order);
    const dateStr = new Date(order.createdAt).toLocaleString();
    const title = co.companyName?.length ? co.companyName : 'Receipt';

    const parts: Buffer[] = [INIT];

    // --- Header (centered): bold, normal font height (double-height caused huge 2-line titles on 58mm) ---
    parts.push(ALIGN_CENTER, BOLD_ON);
    for (const ln of wrapToWidth(slipTextSafe(title), w)) {
      parts.push(Buffer.from(`${ln}\n`, 'utf8'));
    }
    parts.push(BOLD_OFF, SIZE_NORMAL, ALIGN_CENTER);

    if (co.registerNumber) {
      parts.push(Buffer.from(`Registration No: ${slipTextSafe(co.registerNumber)}\n`, 'utf8'));
    }
    if (co.address) {
      for (const part of co.address.split(/\r?\n/)) {
        const t = part.trim();
        if (t) {
          for (const ln of wrapToWidth(slipTextSafe(t), w)) {
            parts.push(Buffer.from(`${ln}\n`, 'utf8'));
          }
        }
      }
    }
    if (co.contactNumber) {
      parts.push(Buffer.from(`${slipTextSafe(co.contactNumber)}\n`, 'utf8'));
    }
    if (co.email) {
      parts.push(Buffer.from(`${slipTextSafe(co.email)}\n`, 'utf8'));
    }

    parts.push(ALIGN_LEFT, Buffer.from(`${rule(w)}\n`, 'utf8'));

    // --- Order meta: bold labels ---
    parts.push(metaLineBuf('Order:', orderRef));
    parts.push(metaLineBuf('Order date:', dateStr));
    parts.push(metaLineBuf('Payment:', paymentLabel));
    parts.push(Buffer.from(`${rule(w)}\n`, 'utf8'));

    // --- Lines: bold `1x` + name, RM right; each add-on on `  + Name` row ---
    for (const line of order.lines) {
      const unitCents = line.basePrice + line.addOns.reduce((s, a) => s + a.price, 0);
      const lineTotalCents = unitCents * line.quantity;
      const qtyPart = `${line.quantity}x`;
      const namePart = ` ${slipTextSafe(line.menuItemName)}`;
      parts.push(receiptItemFirstRow(qtyPart, namePart, rmMoney(lineTotalCents), w));
      for (const a of line.addOns) {
        const nm = slipTextSafe(a.optionName?.trim() || '');
        if (nm) {
          parts.push(Buffer.from(`  + ${nm}\n`, 'utf8'));
        }
      }
    }

    parts.push(Buffer.from(`${rule(w)}\n`, 'utf8'));
    parts.push(padLineBuf('Subtotal', rmMoney(order.subtotalCents), w));
    if (order.discountCents > 0) {
      parts.push(padLineBuf('Discount', `-${rmMoney(order.discountCents)}`, w));
    }

    // Thick rule before grand total
    parts.push(Buffer.from(`${'='.repeat(w)}\n`, 'utf8'));
    parts.push(
      BOLD_ON,
      Buffer.from(`${padLine('Total', rmMoney(order.totalCents), w)}\n`, 'utf8'),
      BOLD_OFF,
    );

    if (order.tenderCents != null && order.tenderCents > 0) {
      parts.push(padLineBuf('Cash received', rmMoney(order.tenderCents), w));
    }
    if (order.changeDueCents != null) {
      const ch = Math.max(0, order.changeDueCents);
      parts.push(padLineBuf('Change due', rmMoney(ch), w));
    }

    parts.push(Buffer.from('\n', 'utf8'), ALIGN_CENTER, Buffer.from('Thank you!\n', 'utf8'), ALIGN_LEFT);
    parts.push(receiptEndSequence());

    return concatBuffers(parts);
  }

  /** §9c kitchen slip — no prices; add-ons one per row with leading "- ". */
  private buildKitchen(order: OrderPrintPayload, widthMm: 58 | 80): Buffer {
    const w = CHARS_PER_LINE[widthMm];
    const lines: string[] = [];
    const orderRef = formatOrderDisplay(order);
    const dateStr = new Date(order.createdAt).toLocaleString();

    lines.push('KITCHEN ORDER');
    lines.push(`Order: ${orderRef}`);
    lines.push(`Order date: ${dateStr}`);
    lines.push(rule(w));

    for (const line of order.lines) {
      const rowText = `${line.quantity}x ${line.menuItemName}`;
      for (const ln of wrapToWidth(rowText, w)) {
        lines.push(ln);
      }
      for (const a of line.addOns) {
        const name = slipTextSafe(a.optionName?.trim() || '');
        if (name) {
          for (const ln of wrapToWidth(`- ${name}`, w)) {
            lines.push(ln);
          }
        }
      }
    }
    lines.push('');

    return concatBuffers([kitchenStartSequence(), slipBuffer(lines), kitchenEndSequence()]);
  }

  private writeDebug(label: string, buf: Buffer): void {
    const path = process.env.THERMAL_PRINT_DEBUG_FILE?.trim();
    if (!path) return;
    const sep = `\n--- ${label} ${new Date().toISOString()} (${buf.length} bytes) ---\n`;
    appendFileSync(path, sep);
    appendFileSync(path, buf);
    appendFileSync(path, '\n');
  }

  private sendToDevice(buf: Buffer, rawPath: string): { ok: boolean; error?: string } {
    const path = normalizeDevicePath(rawPath);
    try {
      const fd = openSync(path, 'w');
      try {
        writeSync(fd, buf);
      } finally {
        closeSync(fd);
      }
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Thermal write failed (${path}): ${msg}`);
      return { ok: false, error: msg };
    }
  }

  private sendRawToWindowsPrinter(
    queueName: string,
    buf: Buffer,
    /** WinSpool job title — must differ per job so receipt and kitchen are two separate print commands. */
    documentTitle: string,
  ): { ok: boolean; error?: string } {
    const id = randomBytes(8).toString('hex');
    const binPath = join(tmpdir(), `pos-escpos-${id}.bin`);
    const psPath = join(tmpdir(), `pos-raw-print-${id}.ps1`);
    writeFileSync(binPath, buf);
    writeFileSync(psPath, '\uFEFF' + WIN_RAW_PRINT_PS1, 'utf8');
    const nameB64 = Buffer.from(queueName, 'utf8').toString('base64');
    const docTitleB64 = Buffer.from(documentTitle.slice(0, 220) || 'POS', 'utf8').toString('base64');
    try {
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          psPath,
          '-BinPath',
          binPath,
          '-NameB64',
          nameB64,
          '-DocTitleB64',
          docTitleB64,
        ],
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      );
      return { ok: true };
    } catch (e) {
      const err = e as Error & { status?: number; stderr?: Buffer | string };
      const stderr = err.stderr != null ? String(err.stderr) : '';
      const msg = stderr.trim() || err.message || String(e);
      this.log.warn(`Windows raw print failed: ${msg}`);
      return { ok: false, error: msg };
    } finally {
      try {
        unlinkSync(binPath);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(psPath);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * USB thermal: Windows often deletes the spool job as soon as bytes hit the driver — long before
   * the paper finishes. We combine Win32 jobs + `System.Printing.PrintQueue` busy/printing, then the
   * caller adds `windowsUsbPostReceiptMs()` (hard minimum for physical feed).
   * `THERMAL_SKIP_SPOOLER_WAIT=1` skips the PowerShell wait only (post-receipt delay still applies).
   */
  private waitForWindowsUsbReceiptSpoolerAndQueue(printerQueueName: string): void {
    const skip = process.env.THERMAL_SKIP_SPOOLER_WAIT?.trim();
    if (skip === '1' || skip?.toLowerCase() === 'true') return;
    const timeoutSec = Math.min(600, Math.max(5, parseInt(process.env.THERMAL_SPOOLER_WAIT_TIMEOUT_SEC || '120', 10) || 120));
    const nameB64 = Buffer.from(printerQueueName, 'utf8').toString('base64');
    const ps = `
$ErrorActionPreference = 'Continue'
$pName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${nameB64}'))
$needle = $pName.ToLowerInvariant()
Start-Sleep -Milliseconds 200
$deadline = (Get-Date).AddSeconds(${timeoutSec})
while ((Get-Date) -lt $deadline) {
  $mine = @(Get-CimInstance -ClassName Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.Name.ToLowerInvariant().Contains($needle) })
  if ($mine.Count -eq 0) { break }
  Start-Sleep -Milliseconds 120
}
try {
  Add-Type -AssemblyName System.Printing -ErrorAction Stop
  $server = New-Object System.Printing.LocalPrintServer
  $pq = $server.GetPrintQueue($pName)
  $deadline2 = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline2) {
    $pq.Refresh()
    if ($pq.NumberOfJobs -eq 0 -and -not $pq.IsPrinting) { break }
    Start-Sleep -Milliseconds 120
  }
  Start-Sleep -Milliseconds 100
  $stable = 0
  $deadline3 = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline3) {
    $pq.Refresh()
    if (-not $pq.IsBusy -and -not $pq.IsPrinting -and ($pq.NumberOfJobs -eq 0)) {
      $stable++
      if ($stable -ge 2) { break }
    } else { $stable = 0 }
    Start-Sleep -Milliseconds 120
  }
} catch { }
exit 0
`;
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Thermal: Windows print-queue wait failed (${msg}); using post-receipt delay only.`);
    }
  }

  /**
   * After spooler/PrintQueue idle — USB drivers may still buffer. Default 2.8s (raise if kitchen overlaps receipt).
   * `THERMAL_WINDOWS_USB_POST_RECEIPT_MS` (0 = skip).
   */
  private windowsUsbPostReceiptMs(): number {
    const raw = process.env.THERMAL_WINDOWS_USB_POST_RECEIPT_MS?.trim();
    if (raw !== undefined && raw !== '') {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return 2800;
  }

  /** COM direct port: pause before second write. `THERMAL_COM_INTER_JOB_MS` (default 2200). */
  private comInterJobFlushMs(): number {
    const raw = process.env.THERMAL_COM_INTER_JOB_MS?.trim();
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return 2200;
  }

  /**
   * Sends one print job. On Windows each call = one WinSpool document (`documentTitle`).
   * On COM/USB each call = one open → write → close (separate “command” per slip).
   */
  private async deliver(
    buf: Buffer,
    label: string,
    documentTitle: string,
  ): Promise<{ ok: boolean; error?: string }> {
    this.writeDebug(label, buf);
    const devicePath = process.env.THERMAL_DEVICE_PATH?.trim();
    if (devicePath) {
      return this.sendToDevice(buf, devicePath);
    }

    const queue = await this.resolvePrinterQueueName();
    if (queue) {
      if (process.platform === 'win32') {
        return this.sendRawToWindowsPrinter(queue, buf, documentTitle);
      }
      return {
        ok: false,
        error: `Printer queue "${queue}" is set but RAW spooler is only implemented on Windows. Use THERMAL_DEVICE_PATH on this OS.`,
      };
    }

    if (process.env.THERMAL_PRINT_DEBUG_FILE?.trim()) {
      this.log.log(`Thermal job "${label}" written to debug file only (no device path or queue).`);
      return { ok: true };
    }

    return {
      ok: false,
      error:
        'Thermal printing is not configured (set company thermalPrinterQueueName, THERMAL_PRINTER_NAME, THERMAL_DEVICE_PATH, or THERMAL_PRINT_DEBUG_FILE)',
    };
  }

  /** Pause after receipt is fully printed (Windows) or flushed (COM), so the cashier can tear (`THERMAL_KITCHEN_DELAY_MS`, default 1500). */
  private receiptToKitchenSendGapMs(): number {
    const raw = process.env.THERMAL_KITCHEN_DELAY_MS?.trim();
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return RECEIPT_TO_KITCHEN_SEND_GAP_MS;
  }

  /**
   * @param failOpenWhenUnconfigured - for POST /orders: return warning instead of failing the sale.
   */
  async print(
    order: OrderPrintPayload,
    variant: 'receipt' | 'kitchen' | 'both',
    widthMm: 58 | 80,
    failOpenWhenUnconfigured: boolean,
  ): Promise<{ ok: boolean; warning?: string; error?: string }> {
    await ensureDefaultPaymentMethods(this.prisma);
    const methods = await this.prisma.paymentMethod.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { code: true, label: true },
    });
    const paymentLabel = resolvePaymentMethodLabel(methods, order);
    const companyHeader = await this.loadCompanyHeader();

    const runDeliver = async (buf: Buffer, label: string, documentTitle: string) => {
      const r = await this.deliver(buf, label, documentTitle);
      if (!r.ok) {
        if (failOpenWhenUnconfigured) {
          return { stop: true as const, result: { ok: true as const, warning: r.error ?? 'Print failed' } };
        }
        return { stop: true as const, result: { ok: false as const, error: r.error ?? 'Print failed' } };
      }
      return { stop: false as const };
    };

    if (variant === 'both') {
      const devicePathEarly = process.env.THERMAL_DEVICE_PATH?.trim();
      if (devicePathEarly) {
        this.log.warn(
          'Thermal: THERMAL_DEVICE_PATH is set, so jobs go to the COM/USB port, not the Windows queue. ' +
            'Remove THERMAL_DEVICE_PATH if you use Settings → thermalPrinterQueueName (USB printer queue).',
        );
      }

      const receiptBuf = this.buildReceipt(order, companyHeader, widthMm, paymentLabel);
      let x = await runDeliver(receiptBuf, 'receipt', 'POS Receipt');
      if (x.stop) return x.result;

      const devicePath = process.env.THERMAL_DEVICE_PATH?.trim();
      if (process.platform === 'win32' && !devicePath) {
        const queue = await this.resolvePrinterQueueName();
        if (queue) {
          this.waitForWindowsUsbReceiptSpoolerAndQueue(queue);
          const padMs = this.windowsUsbPostReceiptMs();
          if (padMs > 0) {
            this.log.debug(`Thermal: USB post-receipt buffer wait ${padMs}ms before tear window.`);
            await delay(padMs);
          }
        }
      } else if (devicePath) {
        await delay(this.comInterJobFlushMs());
      }

      const gapMs = this.receiptToKitchenSendGapMs();
      this.log.debug(`Thermal: tear window ${gapMs}ms before kitchen job.`);
      await delay(gapMs);

      const kitchenBuf = this.buildKitchen(order, widthMm);
      x = await runDeliver(kitchenBuf, 'kitchen', 'POS Kitchen');
      if (x.stop) return x.result;
      return { ok: true };
    }

    if (variant === 'receipt') {
      const buf = this.buildReceipt(order, companyHeader, widthMm, paymentLabel);
      const x = await runDeliver(buf, 'receipt', 'POS Receipt');
      if (x.stop) return x.result;
      return { ok: true };
    }

    const buf = this.buildKitchen(order, widthMm);
    const x = await runDeliver(buf, 'kitchen', 'POS Kitchen');
    if (x.stop) return x.result;
    return { ok: true };
  }
}
