# InSync  
(aka GrumbleSpot, thePoint, Indigo Connect) A free alternative to paid services like Humble Dot that is based on Google Forms and powered by Apps Script.

## Features
- Scheduled invitations for form-based updates are sent out to team members (Monday and Friday morning).
- Scheduled summaries of team members' updates is sent out to team members  (Monday and Friday afternoon).
- Summaries include convenient pre-populated mailto links for sending feedback to individual team members about specific items.
- Flexible and extensible Apps Script/JavaScript back-end.
- Easy form-based system for adding one-off questions to upcoming updates.
- Prior to sending out a summary email, the script stores questions and results in a record, for posterity.

## Benefits
- No need to log in to third party services if your team already uses G Suite.
- Data is stored in Google Forms and Google Sheets, so if your team already trusts G Suite, then there is no need to worry about the security of sensitive project data being stored on third-party servers.
- Free = no monthly per-user fee for an essentially simple service.

  ![](./img/ss_form.png)
  ![](./img/ss_email_invitation.png)
  ![](./img/ss_email_summary.png)

## Set-up
1. Create a [Google Script](script.google.com) project.  
   1. Copy the contents of *Code.gs* into the script editor.  
   1. Run → Run function → ``bootstrap`` to automatically:
      - Generate the registry spreadsheet. This will store configuration parameters, email address, questions that will be asked in every update, and a running record of past questions and responses.
      - Link the registry to the script via the script properties
      - Set up a trigger to send the first invitation on Monday/Friday morning (whichever is sooner).  Subsequenty triggers are automatically configured by the script to maintain the following cadence: Monday AM invitation → Monday PM summary → Friday AM invitation → Friday PM summary → Monday AM invitation → ...
      - Create a form that can be used to add one-off questions to upcoming updates
   1. Finish setting up the registry.
      1. Open the registry (*insync_registry*) in [Google Sheets](sheets.google.com).  
      1. Navigate to the *email* sheet and add user email addresses to the column labeled *team_email_addresses*.  
1. Share the form to add one-off questions by opening *insync_add_question* in [Google Forms](forms.google.com) and sending it to those who should have the ability to add questions.
![](./img/ss_form_add_question.png)  
