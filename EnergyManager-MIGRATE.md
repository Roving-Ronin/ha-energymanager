
# Migrating Energy Manager to GitHub updater for v2.0.0

Energy Manager v2.0.0 introduces a new GitHub-based installation and update system, replacing the previous update server method.

If you are running an older version of Energy Manager, you only need to run a one-time migration. After that, updates can be installed directly from your existing **Energy Manager Updates** section in Home Assistant.

## Step 1 — Open SSH

In Home Assistant, open **Advanced SSH & Web Terminal** and start the terminal (Setting > Apps > Advanced SSH & Web Terminal > Open Web UI).

## Step 2 — Run the migration

Copy and paste the following command into the SSH terminal:

```bash
cd /config && wget -qO migration_energy_manager_updates.py https://raw.githubusercontent.com/ha-energymanager/ha-energymanager/main/migration_energy_manager_updates.py && python3 migration_energy_manager_updates.py
```

The migration automatically installs the new GitHub update scripts and converts the relevant existing Home Assistant helpers to YAML while preserving their saved values. It also creates a backup for recovery.

**Important:** Home Assistant Core will stop and restart automatically during this process. The Home Assistant interface will briefly be unavailable. Do not interrupt the migration.

Wait until the terminal reports that the migration has completed and Home Assistant has restarted. If the migration reports an error, do not proceed to the next step; retain the terminal output for support.

## Step 3 — Check for updates

Once Home Assistant has restarted:

1. Open your normal **Energy Manager Updates** section in Home Assistant.
2. Click **Check Updates**.
3. Wait for the available version to be displayed.
4. Click **Install Update** to install the latest Energy Manager version.

Home Assistant will force reboot during the update. Once the update has completed, confirm that Energy Manager is operating normally.

## All done!

Your Energy Manager installation now uses the new GitHub-based update system. Future updates can be checked for and installed from the same **Energy Manager Updates** section in Home Assistant; the migration script does not need to be run again.

If you encounter a problem, please ask for help through [Energy Manager GitHub Discussions](https://github.com/ha-energymanager/ha-energymanager/discussions).
