import * as React from "react"
import * as ReactDOM from "react-dom"

import socket from "./socket"

import CodeMirror from "codemirror"

require('codemirror/lib/codemirror.css');

const ignoreRemote = "ignore_remote";

class Editor extends React.Component<any, any> {
    constructor() {
        super()

        socket.connect();
        const channel = socket.channel("documents:1");
        channel.join()
          .receive("ok", resp => console.log("joined the video channel ", resp))
          .receive("error", reason => console.log("join failed ", reason))
        channel.on("change", this.onRemoteChange)

        // TODO: Handle error
        this.state = {channel};
    }

    onRemoteChange = ({userId, change}) => {
        const doc: CodeMirror.Doc = this.state.codemirror.getDoc();
        doc.replaceRange(change.text, change.from, change.to, ignoreRemote);
    }

    onLocalChange = (doc: CodeMirror.Editor, change: CodeMirror.EditorChangeLinkedList) => {
        // TODO: Handle error
        if (change.origin !== ignoreRemote) {
            this.state.channel.push("change", change)
                            .receive("error", e => { throw e });
        }
    }

    componentDidMount() {
        const codemirror = CodeMirror.fromTextArea(ReactDOM.findDOMNode(this), { 
            lineNumbers: true,
            value: "Time to do some alchemy!"
        });
        codemirror.on("change", this.onLocalChange)
        this.setState({ codemirror })
    }

    render() {
        return (<textarea />)
    }
}

export default function renderEditor(domNode) {
    ReactDOM.render(
        <Editor/>,
        domNode
    )
}
