import * as React from "react"

import Nested from "./nested"

export default class Test extends React.Component<any, any> {
    render() {
        var test: string = "World"
        return (<h1>Hello {test}! <Nested /></h1>)
    }
}