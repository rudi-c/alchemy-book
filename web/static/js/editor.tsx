import * as React from "react"
import * as ReactDOM from "react-dom"

import CodeMirror from "react-codemirror"

require('codemirror/lib/codemirror.css');

class Editor extends React.Component<any, any> {
    render() {
        return (
            <CodeMirror
                value="test"
                options={{lineNumbers: true}} 
            />)
    }
}

export default function renderEditor(domNode) {
    ReactDOM.render(
        <Editor/>,
        domNode
    )
}
