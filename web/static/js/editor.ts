import * as CodeMirror from "codemirror";

import * as Crdt from "./crdt";
import { EditorSocket } from "./editor-socket";

const IgnoreRemote = "ignore_remote";

export default class Editor {
    protected editorSocket: EditorSocket;
    protected crdt: Crdt.t;
    protected lamport: number;
    protected site: number;
    protected codemirror: CodeMirror.Editor;

    constructor(domNode: HTMLTextAreaElement, editorSocket: EditorSocket) {
        this.codemirror = CodeMirror.fromTextArea(domNode, {
            lineNumbers: true,
            theme: "zenburn"
        });
        this.editorSocket = editorSocket;

        this.editorSocket.connect(this.onInit, this.onRemoteChange);
        this.codemirror.on("change", this.onLocalChange);
    }

    protected onLocalChange = (doc: CodeMirror.Editor, change: CodeMirror.EditorChange) => {
        // TODO: Handle error
        if (change.origin !== IgnoreRemote && change.origin !== "setValue") {
            this.lamport = this.lamport + 1;
            const [newCrdt, changes] = Crdt.updateAndConvertLocalToRemote(this.crdt, this.lamport, this.site, change);
            this.crdt = newCrdt;
            changes.forEach(change => this.editorSocket.sendChange(change, this.lamport));
        }
    }

    protected onRemoteChange = ({userId, change, lamport}) => {
        this.lamport = Math.max(this.lamport, lamport) + 1;
        const [newCrdt, localChange] = Crdt.updateAndConvertRemoteToLocal(this.crdt, change);
        this.crdt = newCrdt;
        if (localChange) {
            this.codemirror.getDoc().replaceRange(localChange.text, localChange.from, localChange.to, IgnoreRemote);
        }
    }

    protected onInit = (resp) => {
        this.crdt = Crdt.init(resp.state);
        this.site = resp.site;
        this.lamport = 0;
        this.codemirror.setValue(Crdt.to_string(this.crdt));
    }
}
