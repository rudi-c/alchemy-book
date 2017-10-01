import * as CodeMirror from "codemirror";

export default class RemoteCursor {
    private widget: HTMLElement;

    constructor(color: string,
                public userId: number,
                public siteId: number,
                private codemirror: CodeMirror.Editor) {
        this.codemirror = codemirror;

        const lineHeight = this.codemirror.defaultTextHeight();

        this.widget = document.createElement("div");
        this.widget.style.position = "absolute";
        this.widget.style.width = "3px";
        this.widget.style.height = `${lineHeight}px`;
        this.widget.style.backgroundColor = color;
        this.widget.style.top = "0px";
    }

    public moveTo(pos: CodeMirror.Position): void {
        // Reinsert the cursor every time to move it.
        this.detach();

        if (pos) {
            const coords = this.codemirror.cursorCoords(pos, "local");
            this.widget.style.left = `${coords.left}px`;
            this.codemirror.getDoc().setBookmark(pos, { widget: this.widget });
        }
    }

    public detach(): void {
        if (this.widget.parentElement) {
            this.widget.parentElement.removeChild(this.widget);
        }
    }
}
