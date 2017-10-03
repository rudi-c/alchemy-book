defmodule AlchemyBook.DocumentRegistry do
    require Logger

    use GenServer

    alias AlchemyBook.Document
    alias AlchemyBook.DocumentSession

    def start_link() do
        GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
    end

    def lookup(document_id) do
        GenServer.call(__MODULE__, {:lookup, document_id})
    end

    def close(document_id) do
        GenServer.cast(__MODULE__, {:close, document_id})
    end

    def handle_call({:lookup, document_id}, _from, sessions) do
        case Map.fetch(sessions, document_id) do
            {:ok, session} -> {:reply, session, sessions}
            :error ->
                Logger.info "Opening session for document #{document_id}"
                document = AlchemyBook.Repo.get!(Document, document_id)
                {:ok, session} = DocumentSession.start_link(
                    document_id, Document.json_to_crdt(document.contents))
                {:reply, session, Map.put(sessions, document_id, session)}
        end
    end

    def handle_cast({:close, document_id}, sessions) do
        case Map.fetch(sessions, document_id) do
            {:ok, session} ->
                Logger.info "Closing session for document #{document_id}"
                DocumentSession.close(session)
                {:noreply, Map.delete(sessions, document_id)}
            :error -> {:noreply, sessions}
        end
    end
end