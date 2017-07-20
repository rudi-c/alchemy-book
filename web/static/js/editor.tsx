import * as React from "react"
import * as ReactDOM from "react-dom"

import CodeMirror from "codemirror"

import { Crdt } from "./crdt"
import socket from "./socket"

require('codemirror/lib/codemirror.css');

// Needed for testing conflicts when you only have one keyboard
const artificialDelay = 3 * 1000;
const ignoreRemote = "ignore_remote";

class Editor extends React.Component<any, any> {
    constructor() {
        super();

        const url = window.location.pathname;
        const documentId = url.substring(url.lastIndexOf('/') + 1);
        this.state = { documentId };
    }

    updateCrdtFromLocal(crdt: Crdt.t, change: CodeMirror.EditorChangeLinkedList) {

    }

    onRemoteChange = ({userId, change}) => {
        const doc: CodeMirror.Doc = this.state.codemirror.getDoc();
        doc.replaceRange(change.text, change.from, change.to, ignoreRemote);
    }

    onLocalChange = (doc: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => {
        // TODO: Handle error
        if (change.origin !== ignoreRemote && change.origin !== "setValue") {
            setTimeout(() => {
                this.setState(previousState => ({ crdt: this.updateCrdtFromLocal(previousState.crdt, change) })) 
                this.state.channel.push("change", change)
                                  .receive("error", e => { throw e });
            }, artificialDelay);
        }
    }

    onInit = (resp) => {
        const crdt: Crdt.t = resp.state;
        this.setState({ crdt });
        this.state.codemirror.setValue(Crdt.to_string(crdt));
    }

    componentDidMount() {
        socket.connect();
        const channel = socket.channel("documents:" + this.state.documentId);
        channel.join()
          .receive("ok", resp => console.log("joined"))
          .receive("error", reason => console.log("join failed ", reason));
        channel.on("init", this.onInit);
        channel.on("change", this.onRemoteChange);

        const codemirror = CodeMirror.fromTextArea(ReactDOM.findDOMNode(this), { 
            lineNumbers: true,
        });
        codemirror.on("change", this.onLocalChange);

        this.setState({ channel, codemirror });
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
