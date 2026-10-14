## ADDED Requirements

### Requirement: Sending feedback without an account

The line popup, the hike popup and the controls panel SHALL each offer
"Envoyer un retour". It SHALL open a form with a category, a message of 10 to
2,000 characters, and the context the app sends with it:

- for a line: the network, the line's short and long names, its `route_id`;
- for a hike: its name and id;
- always: the map's centre and zoom, the app version and the page address,
  except that an issue from a preview SHALL NOT show the preview's address.

The sender MAY add up to three `https://` links, such as a timetable PDF.
The context SHALL be listed in the form before sending. The form SHALL say that
reports are published as public GitHub issues and SHALL NOT ask for contact
details. Sending SHALL NOT require a GitHub account.
On phones the form's send and cancel buttons SHALL stay visible while the form
is open.

#### Scenario: Reporting a wrong PDF link

- **WHEN** the user opens Isère's T40, activates "Envoyer un retour", picks
  "Lien vers les horaires" and sends a message
- **THEN** an issue titled "[Ligne] Cars Région Isère T40 : Lien vers les
  horaires" SHALL be created with the labels `feedback` and `line`, its body
  holding the message and the network, line, `route_id`, position, zoom and app
  version

#### Scenario: A general report

- **WHEN** the user sends a report from the controls panel
- **THEN** the issue SHALL be labelled `feedback` and `general` and carry the
  map position, zoom and app version

#### Scenario: An empty form

- **WHEN** the user presses "Envoyer" with no message
- **THEN** nothing SHALL be sent, and the form SHALL ask for a message of at
  least 10 characters

#### Scenario: Asking for a line

- **WHEN** the user opens the general form
- **THEN** "Demande de ligne" SHALL be among the subjects

#### Scenario: On a small phone

- **WHEN** a user opens the form on a 375×667 screen
- **THEN** "Envoyer" and "Annuler" MUST be visible without scrolling, and no
  field MUST take focus on opening

#### Scenario: Success

- **WHEN** the issue is created
- **THEN** the form SHALL thank the user and link the issue

### Requirement: The relay protects the repository

Reports SHALL be sent to a relay that alone holds the GitHub credentials, and
issues SHALL be opened by a GitHub App limited to Issues: write on this
repository, not by a person's account. The relay SHALL create an issue only
when:

- the report's Turnstile token is valid;
- the request comes from one of the site's own origins;
- the fields are well formed;
- the sender has sent fewer than 3 reports in the past minute, and the relay
  fewer than 50 issues that day.

Otherwise it SHALL refuse with an error the form can show, and create nothing.
It SHALL NOT store or forward the sender's IP address. Links, in the message or
the link field, SHALL NOT be rendered as links in the issue. Reports sent from the preview
SHALL also carry the `test` label.

#### Scenario: A bot without a token

- **WHEN** a request reaches the relay without a valid Turnstile token
- **THEN** no issue SHALL be created and the relay SHALL answer 403

#### Scenario: A burst of reports

- **WHEN** one sender sends a fourth report within a minute
- **THEN** no issue SHALL be created and the form SHALL ask them to try later

### Requirement: Reporting keeps working when the relay does not

When the relay is not configured, cannot be reached, or fails, the form SHALL
say so and offer GitHub's new-issue page with the title and context filled in.
The map SHALL be unaffected.

#### Scenario: A build without a relay

- **WHEN** the app is built with `VITE_FEEDBACK_URL` set to an empty string
- **THEN** "Envoyer un retour" SHALL open GitHub's new-issue page, pre-filled
