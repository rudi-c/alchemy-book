defmodule AlchemyBook.Document do
  use AlchemyBook.Web, :model

  schema "documents" do
    field :title, :string
    field :contents, :string
    belongs_to :user, AlchemyBook.User

    timestamps()
  end

  @doc """
  Builds a changeset based on the `struct` and `params`.
  """
  def changeset(struct, params \\ %{}) do
    struct
    |> cast(params, [:title, :contents])
    |> validate_required([:title])
  end
end
