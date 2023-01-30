import json
import smtplib
import email.message

smtp_server = 'smtp.office365.com'
smtp_port = 587
mailer_login = 'support@pollenpay.com'
mailer_pass = '5$k4e_5Fw@jUU?sB3N'
# mailer_login = 'donotreply@pollenpay.com'
# mailer_pass = '>s:2\=KlB65"nV_qcSd*q]dS'

def lambda_handler(event, context):
    mail_result = None
    try:
        msg = email.message.Message()
        msg['Subject'] = event['subject']
        msg['From'] = mailer_login
        msg['To'] = ', '.join(event['recipients'])
        msg['Cc'] = ', '.join(event['cc'])
        msg.add_header('Content-Type', 'text/html')
        mail_footer = open("body_utf8.html","rb").read().decode("utf-8")
        html = f"<p>{event['mailbody']}</p>" + mail_footer
        msg.set_payload(html)

        with smtplib.SMTP(smtp_server, smtp_port) as mail:
            mail.ehlo()
            mail.starttls()
            mail.login(mailer_login, mailer_pass)
            mail_result = mail.send_message(msg)
            mail.quit()

            return {
                "statusCode": 200,
                "body": json.dumps({
                    "recipients": event['recipients'],
                    "cc": event['cc'],
                    "mailbody": event['mailbody'],
                    "errors": f"{mail_result}"
                }),
            }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error_message": str(e),
                "mailer_error": f"{mail_result}"
            }),
        }
