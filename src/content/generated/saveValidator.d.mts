export interface ValidationError { instancePath: string; message?: string; keyword: string }
declare const validate: ((data: unknown) => boolean) & { errors?: ValidationError[] | null };
export default validate;
