# RoboSteading

This is the repository for the RoboSteading static site and DNS configuration.

## Environment Setup

Environment variables are securely managed in 1Password. To preview or push changes, you must authenticate with the 1Password CLI (`op`) and use `op run`.

1. Ensure you have the [1Password CLI](https://developer.1password.com/docs/cli) installed and are signed in.
2. The `.env` file contains secret references pointing to the `Dev_Environments` vault.

## Usage

To preview DNS changes locally:

```bash
op run --env-file .env -- dnscontrol preview
```

To push DNS changes:

```bash
op run --env-file .env -- dnscontrol push
```
