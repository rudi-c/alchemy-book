import * as React from "react"
import * as ReactDOM from "react-dom"

import Editor from "./editor"
import { EditorSocket, UserPresence } from "./editor_socket"

// Yes, React is overkill right now
class Collaborator extends React.Component<any, any> {
    editor: Editor

    constructor() {
        super();

        this.state = { presences: [], exceededLimit: false };
    }

    presenceCallback = (presences: UserPresence[]) => {
        this.setState({ presences: [...presences] });
        this.editor.updateCursors(presences);
    }

    limitCallback = (exceeded: boolean) => {
        this.setState({ exceededLimit: exceeded });
    }

    componentDidMount() {
        const url = window.location.pathname;
        const documentId = url.substring(url.lastIndexOf('/') + 1);
        const editorSocket = new EditorSocket(documentId, this.presenceCallback);
        const textarea = ReactDOM.findDOMNode(this).getElementsByTagName("textarea").item(0);
        this.editor = new Editor(textarea, editorSocket, this.limitCallback);
    }

    render() {
        const users: Map<number, UserPresence> = new Map();
        this.state.presences.forEach((presence: UserPresence) => {
            users.set(presence.userId, presence); 
        });
        const indicators = Array.from(users).map(([userId, presence]: [number, UserPresence]) =>
            <div key={userId} className="user">
                <div className="circle" style={{background: presence.color}}></div>
                <div className="username">{ presence.username }</div>
            </div>
        );
        return (
            <div className="page">
                <header className="header">
                    <div className="nav-left indicators">
                        { indicators }
                    </div>
                    <div className="nav-right">
                        <a href="/">back to main</a>
                    </div>
                </header>
                <div className="container">
                    { this.state.exceededLimit &&
                        <div className="exceeded-warning">
                            <p>Operation cancelled: Exceeded the 2500 character limit of this document</p>
                            <p>I know you'd like to stress test this application but my server is pretty small! Please run tests on your own machine instead and let me know what you find!</p>
                        </div>
                    }
                    <div className="code-container">
                        <textarea />
                    </div>
                </div>
            </div>
        );
    }
}

export default function renderCollaborator(domNode) {
    ReactDOM.render(
        <Collaborator/>,
        domNode
    );
}