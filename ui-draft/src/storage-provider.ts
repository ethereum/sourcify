export default class StorageProvider {
    static clear() {
        localStorage.clear();
    }

    static getDisplayed(): string {
        return localStorage.displayed;
    }

    static setDisplayed(displayed: string) {
        localStorage.displayed = displayed;
    }
}