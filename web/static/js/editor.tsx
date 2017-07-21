import * as React from "react"
import * as ReactDOM from "react-dom"

import CodeMirror from "codemirror"

import { Crdt } from "./crdt"
import EditorSocket from "./editor-socket"

require('codemirror/lib/codemirror.css');

const ignoreRemote = "ignore_remote";

// Yes, React is completely unecessary right now
class Editor extends React.Component<any, any> {
    editorSocket: EditorSocket
    crdt: Crdt.t
    lamport: number
    codemirror: CodeMirror.Editor

    constructor() {
        super();

        const url = window.location.pathname;
        const documentId = url.substring(url.lastIndexOf('/') + 1);
        this.editorSocket = new EditorSocket(documentId, this.onInit, this.onRemoteChange);
        this.state = { documentId };
    }

    onLocalChange = (doc: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => {
        // TODO: Handle error
        if (change.origin !== ignoreRemote && change.origin !== "setValue") {
            this.lamport = this.lamport + 1;
            this.editorSocket.sendChange(change, this.lamport);
        }
    }

    onRemoteChange = ({userId, change, lamport}) => {
        this.lamport = Math.max(this.lamport, lamport) + 1;
        this.codemirror.getDoc().replaceRange(change.text, change.from, change.to, ignoreRemote);
    }

    onInit = (resp) => {
        this.crdt = resp.state;
        this.lamport = 0;
        this.codemirror.setValue(Crdt.to_string(this.crdt));
    }

    componentDidMount() {
        this.editorSocket.connect();

        this.codemirror = CodeMirror.fromTextArea(ReactDOM.findDOMNode(this), { 
            lineNumbers: true,
        });
        this.codemirror.on("change", this.onLocalChange);
    }

    render() {
        return (<textarea />);
    }
}

export default function renderEditor(domNode) {
    ReactDOM.render(
        <Editor/>,
        domNode
    );
}
