defmodule AlchemyBook.Repo.Migrations.User do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :anonymous, :boolean, default: false
    end
  end
end
