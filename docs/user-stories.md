# User Stories for ColdTrace Frontend

This document outlines the user stories and acceptance criteria for the `coldtrace-frontend` project, reflecting the current functionality implemented across the main bounded contexts. Each story is written from the user's perspective and uses the Given-When-Then format for acceptance criteria, focusing on behavior rather than visual details.

---

## Identity and Access

### US007: Creating an Account

As an authorized visitor,
I want to create an account linked to an organization,
so that I can start using ColdTrace as the first administrator of that organization.

#### Acceptance Criteria

- **Scenario: Visitor registers valid organization and account data**
    - **Given** the visitor completes the sign-up form with valid organization and access data,
    - **When** the visitor submits the account creation request,
    - **Then** the application creates the organization and the founder user with administrative access.

- **Scenario: Visitor uses an email that already exists**
    - **Given** another user already exists with the same email,
    - **When** the visitor submits the sign-up form,
    - **Then** the application rejects the request and shows that the account already exists.

### US008: Representing Account Verification

As a registered user,
I want the application to represent my account as enabled after registration,
so that the frontend delivery can continue without real email delivery.

#### Acceptance Criteria

- **Scenario: Account is created in the frontend scope**
    - **Given** the account was created correctly,
    - **When** the registration flow finishes,
    - **Then** the account is treated as available for sign in.

### US009: Signing In

As a registered user,
I want to sign in with my email and demo password,
so that I can access the dashboard with my organization, role, and permissions.

#### Acceptance Criteria

- **Scenario: User signs in with valid demo credentials**
    - **Given** the user exists in the local data source,
    - **When** the user enters valid credentials,
    - **Then** the application loads the user, organization, role, and dashboard access.

- **Scenario: User enters invalid credentials**
    - **Given** the email or password is incorrect,
    - **When** the user attempts to sign in,
    - **Then** the application blocks access and displays an error message.

### US010: Recovering a Password

As a registered user,
I want to request password recovery,
so that I can validate the reset experience without a real email backend.

#### Acceptance Criteria

- **Scenario: User requests recovery with a registered email**
    - **Given** the email exists in the local users collection,
    - **When** the user submits the recovery request,
    - **Then** the application shows the simulated recovery confirmation.

- **Scenario: User requests recovery with an unknown email**
    - **Given** the email is not registered,
    - **When** the user submits the recovery request,
    - **Then** the application informs that the account cannot be found.

### US011: Managing Roles and Permissions

As an organization administrator,
I want to manage users, roles, and permissions,
so that each person can access the actions that match their operational responsibility.

#### Acceptance Criteria

- **Scenario: Administrator creates or updates an internal user**
    - **Given** the current user has access management permissions,
    - **When** the user creates an internal account or updates a role,
    - **Then** the application keeps that user within the active organization.

- **Scenario: Non-administrator opens the access module**
    - **Given** the current user does not have management permissions,
    - **When** the user opens the access screens,
    - **Then** the application keeps the information in read-only mode or restricts the action.

---

## Asset Management

### US012-US017: Managing Assets, Devices, and Gateways

As an operations user,
I want to register assets, link IoT devices, pair gateways, and track calibration and connectivity,
so that the monitoring infrastructure is organized and ready for operational control.

#### Acceptance Criteria

- **Scenario: User registers a cold room or refrigerated transport unit**
    - **Given** the user has asset management permissions,
    - **When** the user enters valid asset information,
    - **Then** the application stores the asset and shows it in the asset list.

- **Scenario: User links an IoT device to an asset**
    - **Given** an asset and an available device exist,
    - **When** the user links them,
    - **Then** the asset becomes available for monitoring.

- **Scenario: User reviews calibration and connectivity**
    - **Given** assets, devices, and gateways exist in the organization,
    - **When** the user opens the assets module,
    - **Then** the application shows calibration, connectivity, and operational state indicators.

---

## Monitoring

### US018-US023: Monitoring Temperature, Humidity, Connectivity, and Offline Sync

As an operations user,
I want to monitor current readings, detect out-of-range values, review connectivity, and synchronize pending readings,
so that I can react to operational risks in the cold chain.

#### Acceptance Criteria

- **Scenario: User opens the operational dashboard**
    - **Given** assets and readings exist for the active organization,
    - **When** the user opens the dashboard,
    - **Then** the application shows KPIs, temperature trends, storage distribution, recent alerts, and maintenance information.

- **Scenario: User opens asset monitoring**
    - **Given** assets, devices, gateways, readings, and asset settings exist for the active organization,
    - **When** the user opens the asset monitoring view,
    - **Then** the application shows thermal condition, connectivity, calibration, and operating range information per asset.

- **Scenario: A reading is out of range**
    - **Given** a sensor reading exceeds the configured safety range,
    - **When** the dashboard evaluates readings,
    - **Then** the application marks the reading as an alert or risk indicator.

- **Scenario: Pending offline readings exist**
    - **Given** readings are marked as pending synchronization,
    - **When** the user triggers sync,
    - **Then** the application changes their state to synced in the frontend store.

---

## Alerts

### US024: Creating Thermal Incidents

As an operations user,
I want the application to create incidents from out-of-range readings,
so that critical cold-chain events can be followed from the alerts module.

#### Acceptance Criteria

- **Scenario: Reading exceeds the configured safety range**
    - **Given** an asset has safety settings and a reading outside the valid range,
    - **When** the alerts workflow evaluates the reading,
    - **Then** the application creates or shows an incident linked to the affected asset.

### US025: Reviewing Alert Notifications

As an operations user,
I want to review alert notifications from the sidebar,
so that incident information is available without using inactive chat or topbar controls.

#### Acceptance Criteria

- **Scenario: User opens notifications**
    - **Given** notifications exist for the active organization,
    - **When** the user opens the notifications page,
    - **Then** the application lists the notification message, channel, status, and related incident.

### US026-US028: Recognizing, Escalating, and Closing Incidents

As an authorized operations user,
I want to recognize incidents, review escalations, and close incidents with corrective evidence,
so that the alert response lifecycle is traceable.

#### Acceptance Criteria

- **Scenario: User recognizes an open incident**
    - **Given** an open incident exists and the user has alert resolution permission,
    - **When** the user recognizes the incident,
    - **Then** the application records the responsible user and recognition time.

- **Scenario: Incident remains unattended**
    - **Given** an incident matches the escalation criteria,
    - **When** the alerts workflow evaluates unattended incidents,
    - **Then** the application marks the incident as escalated for review.

- **Scenario: User closes an incident**
    - **Given** an incident has been reviewed and the user enters corrective action and evidence,
    - **When** the user closes the incident,
    - **Then** the application stores closure metadata and updates the incident status.

---

## Reports and Audit Evidence

### US029: Generating a Daily Log

As a quality or operations user,
I want to generate a daily log by date and asset,
so that I can review expected readings, registered readings, missing readings, and compliance.

#### Acceptance Criteria

- **Scenario: User selects a day with available readings**
    - **Given** readings exist for the selected day,
    - **When** the user opens the daily log,
    - **Then** the application groups readings by asset and shows completeness and status.

### US030: Consulting Operational History

As a quality user,
I want to review readings, alerts, and incidents by period and event type,
so that I can reconstruct operational behavior over time.

#### Acceptance Criteria

- **Scenario: User filters event history**
    - **Given** readings, alert events, or incident events exist,
    - **When** the user filters by period, asset, and event type,
    - **Then** the application shows a chronological event list and summary metrics.

### US031-US032: Exporting Compliance and Monthly Reports

As an administrative user,
I want to export compliance and monthly reports,
so that I can download evidence for review or audit.

#### Acceptance Criteria

- **Scenario: User downloads a report**
    - **Given** the selected period has data,
    - **When** the user triggers the export,
    - **Then** the application downloads a CSV file named with the organization and selected period.

### US033-US034: Reviewing Findings and Audit Evidence

As a quality user,
I want to detect missing records, close findings, and prepare audit evidence,
so that the organization can respond to internal or external reviews.

#### Acceptance Criteria

- **Scenario: User reviews findings**
    - **Given** missing readings, open incidents, or compliance limitations exist,
    - **When** the user opens the findings module,
    - **Then** the application shows the finding severity, status, and affected asset.

- **Scenario: User prepares audit evidence**
    - **Given** monitoring data and report records exist,
    - **When** the user filters evidence by period and asset,
    - **Then** the application builds a checklist and allows CSV export.

---

## Operational Configuration and Maintenance

### US035: Configuring Safety Ranges

As an administrative user,
I want to configure safety ranges per organization or asset,
so that monitoring, alerts, and reports use operating limits stored in the API data.

#### Acceptance Criteria

- **Scenario: User configures safety ranges**
    - **Given** the organization has assets and asset settings,
    - **When** the user defines valid temperature and humidity ranges,
    - **Then** the application saves the settings and uses them in monitoring and reports.

### US036: Configuring Operational Parameters

As an administrative user,
I want to maintain operational parameters for monitored assets,
so that ColdTrace reflects the expected measurement frequency and sensor configuration.

#### Acceptance Criteria

- **Scenario: User updates operational parameters**
    - **Given** an asset has editable settings,
    - **When** the user updates expected readings or measurement parameters,
    - **Then** the application persists the configuration and keeps dashboard/report calculations aligned.

### US037: Scheduling Preventive Maintenance

As an operations user,
I want to schedule preventive maintenance for cold-chain assets,
so that routine service can be planned and tracked.

#### Acceptance Criteria

- **Scenario: User creates a preventive maintenance schedule**
    - **Given** an asset belongs to the active organization,
    - **When** the user creates a valid maintenance schedule,
    - **Then** the application stores it and shows it in the preventive maintenance view.

### US038: Tracking Technical Service

As an operations user,
I want to track technical service requests,
so that corrective work can be followed after incidents or operational issues.

#### Acceptance Criteria

- **Scenario: User reviews technical service requests**
    - **Given** service requests exist for the active organization,
    - **When** the user opens the technical service view,
    - **Then** the application shows request status, priority, affected asset, and service details.

- **Scenario: User updates a technical service request**
    - **Given** a technical service request is open,
    - **When** the user updates its status or service information,
    - **Then** the application persists the change in the local API.
