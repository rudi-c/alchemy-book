defmodule AlchemyBook.UserController do
  use AlchemyBook.Web, :controller
  plug :authenticate_user when action in [:index, :show]

  alias AlchemyBook.User

  def new(conn, _params) do
    changeset = User.changeset(%User{})
    render conn, "new.html", changeset: changeset
  end

  def create(conn, %{"user" => user_params}) do
    IO.puts inspect user_params
    changeset = User.registration_changeset(%User{}, user_params)
    case Repo.insert(changeset) do
      {:ok, user} ->
        conn
        |> AlchemyBook.Auth.login(user)
        |> put_flash(:info, "#{user.name} created!")
        |> redirect(to: document_path(conn, :index))
      {:error, changeset} ->
        render(conn, "new.html", changeset: changeset)
    end
  end
end
