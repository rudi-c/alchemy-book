defmodule AlchemyBook.PageController do
  use AlchemyBook.Web, :controller

  def index(conn, _params) do
    render conn, "index.html"
  end
end
