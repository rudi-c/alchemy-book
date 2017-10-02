import "phoenix_html"

import renderCollaborator from "./collaborator"

window.onerror = function (msg, url, lineNo, columnNo, error) {
    fetch("/api/reporterror", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
        }),
    })

    return false;
}

const collaborator = document.getElementById("collaborator");
if (collaborator) {
    renderCollaborator(collaborator);
}
