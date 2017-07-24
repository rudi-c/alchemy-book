import * as React from "react"
import * as ReactDOM from "react-dom"

import CodeMirror from "codemirror"

import * as Crdt from "./crdt"
import EditorSocket from "./editor-socket"

require('codemirror/lib/codemirror.css');

const IgnoreRemote = "ignore_remote";

// Yes, React is completely unecessary right now
class Editor extends React.Component<any, any> {
    editorSocket: EditorSocket
    crdt: Crdt.t
    lamport: number
    site: number
    codemirror: CodeMirror.Editor

    constructor() {
        super();

        const url = window.location.pathname;
        const documentId = url.substring(url.lastIndexOf('/') + 1);
        this.editorSocket = new EditorSocket(documentId, this.onInit, this.onRemoteChange);
        this.state = { documentId };
    }

    onLocalChange = (doc: CodeMirror.Editor, change: CodeMirror.EditorChange) => {
        console.log(change);
        // TODO: Handle error
        if (change.origin !== IgnoreRemote && change.origin !== "setValue") {
            this.lamport = this.lamport + 1;
            const [newCrdt, changes] = Crdt.updateAndConvertLocalToRemote(this.crdt, this.lamport, this.site, change);
            this.crdt = newCrdt;
            changes.forEach(change => this.editorSocket.sendChange(change, this.lamport));
        }
    }

    onRemoteChange = ({userId, change, lamport}) => {
        this.lamport = Math.max(this.lamport, lamport) + 1;
        const [newCrdt, localChange] = Crdt.updateAndConvertRemoteToLocal(this.crdt, change);
        this.crdt = newCrdt;
        if (localChange) {
            this.codemirror.getDoc().replaceRange(localChange.text, localChange.from, localChange.to, IgnoreRemote);
        }
    }

    onInit = (resp) => {
        this.crdt = Crdt.init(resp.state);
        this.site = resp.site;
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
