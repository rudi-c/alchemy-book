defmodule AlchemyBook.UserController do
  use AlchemyBook.Web, :controller
  plug :authenticate_user when action in [:index, :show]

  alias AlchemyBook.User

  def new(conn, _params) do
    changeset = User.changeset(%User{})
    render conn, "new.html", changeset: changeset
  end

  def create(conn, %{"user" => user_params}) do
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

  def create_anonymous() do
    unique_user = "Guest" <> to_string(:rand.uniform(99999));
    if Repo.get_by(User, username: unique_user) == nil do
      anonymous = %AlchemyBook.User{name: unique_user, username: unique_user, anonymous: true}
      Repo.insert!(anonymous)
    else
      # Generate random usernames until we find an unique one
      create_anonymous()
    end
  end
end
