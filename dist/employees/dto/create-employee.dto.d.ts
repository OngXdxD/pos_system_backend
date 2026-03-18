declare const ROLES: readonly ["SUPER_ADMIN", "EMPLOYEE"];
export declare class CreateEmployeeDto {
    name: string;
    passcode: string;
    role: (typeof ROLES)[number];
}
export {};
