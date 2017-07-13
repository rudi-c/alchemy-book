# This file is responsible for configuring your application
# and its dependencies with the aid of the Mix.Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.
use Mix.Config

# General application configuration
config :alchemy_book,
  ecto_repos: [AlchemyBook.Repo]

# Configures the endpoint
config :alchemy_book, AlchemyBook.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "crR5QeEMT61tSE2yhSiKeTvtJy2McrYClcPqhcsJhslNSvBc5UDn7L/58Q4FSrwm",
  render_errors: [view: AlchemyBook.ErrorView, accepts: ~w(html json)],
  pubsub: [name: AlchemyBook.PubSub,
           adapter: Phoenix.PubSub.PG2]

# Configures Elixir's Logger
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{Mix.env}.exs"
