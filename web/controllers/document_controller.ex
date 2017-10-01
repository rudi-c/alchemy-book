defmodule AlchemyBook.DocumentController do
  use AlchemyBook.Web, :controller
  # TODO: reimplement permissions for `show` for private documents
  plug :authenticate_user when action in [:index]

  alias AlchemyBook.Document

  # Turns <action>(conn, params) into <action>(conn, params, user)
  def action(conn, _) do
    case conn.assigns.current_user do
      nil ->
        user = AlchemyBook.UserController.create_anonymous()
        conn = AlchemyBook.Auth.login(conn, user)
        apply(__MODULE__, action_name(conn),
              [conn, conn.params, user])
      user ->
        apply(__MODULE__, action_name(conn),
              [conn, conn.params, user])
    end
  end

  def index(conn, _params, _user) do
    documents = Repo.all(Document)
    render(conn, "index.html", documents: documents)
  end

  def new(conn, _params, user) do
    #changeset = Document.changeset(%Document{})
    #render(conn, "new.html", changeset: changeset)

    create(conn, %{ "document" => Document.default() }, user)
  end

  def create(conn, params = %{"document" => document_params}, user) do
    changeset =
      user
      |> build_assoc(:documents)
      |> Document.changeset(document_params)

    case Repo.insert(changeset) do
      {:ok, document} ->
        conn
        |> redirect(to: Path.join(document_path(conn, :index),
          Document.slug_from_id(document.id)))
      {:error, changeset} ->
        index(conn, params, user)
    end
  end

  def show(conn, %{"id" => id}, _user) do
    with {:ok, [actual_id]} <- Document.id_from_slug(id),
         document = %Document{} <- Repo.get(Document, actual_id)
    do
      render(conn, "show.html", document: document)
    else
      _ ->
        conn
        |> put_status(404)
        |> render(AlchemyBook.ErrorView, :"404", message: "not found")
    end
  end

  def edit(conn, %{"id" => id}, _user) do
    document = Repo.get!(Document, id)
    changeset = Document.changeset(document)
    render(conn, "edit.html", document: document, changeset: changeset)
  end

  def update(conn, %{"id" => id, "document" => document_params}, _user) do
    document = Repo.get!(Document, id)
    changeset = Document.changeset(document, document_params)

    case Repo.update(changeset) do
      {:ok, document} ->
        conn
        |> put_flash(:info, "Document updated successfully.")
        |> redirect(to: document_path(conn, :show, document))
      {:error, changeset} ->
        render(conn, "edit.html", document: document, changeset: changeset)
    end
  end

  def delete(conn, %{"id" => id}, _user) do
    document = Repo.get!(Document, id)

    # Here we use delete! (with a bang) because we expect
    # it to always work (and if it does not, it will raise).
    Repo.delete!(document)

    conn
    |> put_flash(:info, "Document deleted successfully.")
    |> redirect(to: document_path(conn, :index))
  end

  def save(id, crdt) do
    document = Repo.get!(Document, id)
    changeset = Ecto.Changeset.change(document, contents: Document.crdt_to_json(crdt))
    Repo.update!(changeset)
  end

  defp user_documents(user) do
    assoc(user, :documents)
  end
end
