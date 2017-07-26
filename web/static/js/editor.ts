import * as CodeMirror from "codemirror";

import * as Crdt from "./crdt";
import EditorSocket from "./editor-socket";

require("codemirror/lib/codemirror.css");

const IgnoreRemote = "ignore_remote";

export default class Editor {
    private editorSocket: EditorSocket;
    private crdt: Crdt.t;
    private lamport: number;
    private site: number;
    private codemirror: CodeMirror.Editor;

    constructor(domNode: HTMLTextAreaElement, editorSocket: EditorSocket) {
        this.codemirror = CodeMirror.fromTextArea(domNode, {
            lineNumbers: true,
        });
        this.editorSocket = editorSocket;

        this.editorSocket.connect(this.onInit, this.onRemoteChange);
        this.codemirror.on("change", this.onLocalChange);
    }

    private onLocalChange = (doc: CodeMirror.Editor, change: CodeMirror.EditorChange) => {
        // TODO: Handle error
        if (change.origin !== IgnoreRemote && change.origin !== "setValue") {
            this.lamport = this.lamport + 1;
            const [newCrdt, changes] = Crdt.updateAndConvertLocalToRemote(this.crdt, this.lamport, this.site, change);
            this.crdt = newCrdt;
            changes.forEach(change => this.editorSocket.sendChange(change, this.lamport));
        }
    }

    private onRemoteChange = ({userId, change, lamport}) => {
        this.lamport = Math.max(this.lamport, lamport) + 1;
        const [newCrdt, localChange] = Crdt.updateAndConvertRemoteToLocal(this.crdt, change);
        this.crdt = newCrdt;
        if (localChange) {
            this.codemirror.getDoc().replaceRange(localChange.text, localChange.from, localChange.to, IgnoreRemote);
        }
    }

    private onInit = (resp) => {
        this.crdt = Crdt.init(resp.state);
        this.site = resp.site;
        this.lamport = 0;
        this.codemirror.setValue(Crdt.to_string(this.crdt));
    }
}
