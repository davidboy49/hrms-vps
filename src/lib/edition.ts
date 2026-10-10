/**
 * Which edition this installation is. Set by the person who runs the server (EDITION=payroll in .env), never by the customer.
 * "standard" (the default) is HR Toch as it always was. "payroll" adds the Payroll section and its permissions.
 */
export const payrollEdition = () => process.env.EDITION === "payroll"
