# GrumbleSpot  
(aka thePoint, InSync, and Indigo Connect) A free alternative to paid services like Humble Dot that is based on Google Forms and powered by Apps Scripts.

- Time scheduled invitations for form-based updates are sent out to team members (Monday and Friday morning).
- Tme scheduled summaries of team members' updates is sent out to team members  (Monday and Friday afternoon).
- Summaries includes convenient links for sending feedback to individual team members about specific items.
- No need to log in to third party services if your team already uses G Suite.
- Data is stored in Google Forms and Google Sheets, so if your team already trusts G Suite, then there is no need to worry about the security of sensitive project data being stored on third-party servers.
- Flexible and extensible Apps Script (JavaScript) back-end.
- Easy form-based system for adding one-off questions to upcoming updates.
- Free, so no monthly per-user fee for an essentially simple service.
- See screen shots for insight regarding setting up your own implementation.
- Copy contents of Code.gs into Google Forms Script Editor (scripts.google.com).
- Set File → Project properties → Script properties.
- The script reuses the same form container; the questions and responses are cleared prior to sending an invitation.
- Prior to sending out a summary email, the script stores questions and results in a record, for posterity.

![](./img/ss_form.png)
![](./img/ss_form_add_question.png)
![](./img/ss_email_invitation.png)
![](./img/ss_email_summary.png)
![](./img/ss_script_props.png)
![](./img/ss_registry_record.png)
![](./img/ss_registry_emails.png)
![](./img/ss_registry_ids.png)
![](./img/ss_registry_static_questions.png)
