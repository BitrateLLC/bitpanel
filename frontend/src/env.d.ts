import type { DefineComponent } from "vue";

declare module "*.vue" {
    const component: DefineComponent<object, object, unknown>;
    export default component;
}

type LocaleTree = Record<string, unknown>;

declare global {
    interface Window {
        settings?: {
            title?: string;
            logo?: string;
            version?: string;
            secure_path?: string;
        };
        XBOARD_TRANSLATIONS?: Record<string, LocaleTree>;
    }
}

export {};
