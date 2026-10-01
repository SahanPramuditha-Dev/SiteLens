# SiteLens Privacy Policy

SiteLens is designed with privacy and security as a core principle. This document outlines how SiteLens handles data.

## Local and Offline First

SiteLens operates entirely within your browser and local environment. 

- **No Telemetry or Tracking:** SiteLens does not collect, send, or upload any telemetry, usage analytics, or error reports.
- **No External Servers:** Your assessment data, findings, and configuration stay on your device. There is no team upload, syncing, or external issue publishing.
- **Local Technology Detection:** Technology detection uses SiteLens's built-in catalog. It does not communicate with external APIs (like Wappalyzer's commercial database) or send technology lookups outside your device.

## Data Collection and Redaction

SiteLens collects data to perform security and configuration assessments.

- **Transient Data Processing:** Full raw inline code, cookie values, storage contents, query strings, fragments, and credentials in URLs are evaluated transiently.
- **Redaction:** Potential secret values are represented by metadata or fingerprints in the stored evidence, never the complete values.
- **Secrets & Configuration View:** Full token or API-key values can be temporarily viewed directly from the original live document, but these complete values are never saved to history, reports, or exports. Re-inspecting after navigating away cannot recover these values.

## Optional Permissions

Certain features require explicit optional permissions, which you control:
- **Header inspection** requires optional access to the target site.
- **Cookie inspection** uses a separate optional permission and checkbox (values are still omitted).
- **Bundle inspection** requests are tightly scoped and require optional access to each destination.

## Backups

When using the backup feature:
- Backups contain redacted assessments and lifecycle events.
- Site permissions and any transient live values are strictly excluded from exported backups.

## User Control

You are in full control of your assessments. You can revoke permissions, apply path exclusions, use local environments, and completely delete your local SiteLens storage at any time.

*Review the evidence details in your generated reports before sharing them with others, as they may contain sensitive security configurations or technology details.*
