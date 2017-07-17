defmodule AlchemyBook.DocumentChannel do
    use AlchemyBook.Web, :channel

    def join("documents:" <> document_id, _params, socket) do
        {:ok, assign(socket, :document_id, String.to_integer(document_id))}
    end

    def handle_in("change", params, socket) do
        IO.puts inspect params
        {:reply, :ok, socket}
    end
end