import * as React from "react"
import * as ReactDOM from "react-dom"

import socket from "./socket"

import CodeMirror from "react-codemirror"

require('codemirror/lib/codemirror.css');

class Editor extends React.Component<any, any> {
    constructor() {
        super()

        socket.connect();
        const channel = socket.channel("documents:1");
        channel.join()
          .receive("ok", resp => console.log("joined the video channel ", resp))
          .receive("error", reason => console.log("join failed ", reason))

        // TODO: Handle error
        this.state = {channel};
    }

    onChange = (doc: string, change: ReactCodeMirror.Change) => {
        console.log(doc)
        console.log(change)
        this.state.channel.push("change", change)
                          .receive("error", e => console.log(e));
    }

    render() {
        return (
            <CodeMirror
                value="Time to do some alchemy!"
                options={{lineNumbers: true}} 
                onChange={this.onChange}
            />)
    }
}

export default function renderEditor(domNode) {
    ReactDOM.render(
        <Editor/>,
        domNode
    )
}
