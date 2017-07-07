defmodule AlchemyBook.User do
  use AlchemyBook.Web, :model

  schema "users" do
    field :name, :string
    field :username, :string
    field :password, :string, virtual: true # not persisted
    field :password_hash, :string

    timestamps()
  end

  def changeset(model, params \\ :invalid) do
    model
    |> cast(params, ~w(name username))
    |> validate_required([:name, :username])
    |> validate_length(:username, min: 1, max: 20)
  end
end
