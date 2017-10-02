defmodule AlchemyBook.ReportErrorController do
  use AlchemyBook.Web, :controller
  require Logger

  plug :accepts, ["json"]

  def handle(conn, params) do
    Logger.error(inspect params)
    json(conn, %{body: "ok"})
  end
end