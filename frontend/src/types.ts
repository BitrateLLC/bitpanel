export interface AdminSettings {
    title?: string;
    logo?: string;
    version?: string;
    secure_path?: string;
}

export type Row = Record<string, unknown>;

export interface PaginatedRows {
    data: Row[];
    total?: number;
    current_page?: number;
    per_page?: number;
    last_page?: number;
}
