export const ResetPasswordTemplate = (resetUrl: string): string => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your password</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:40px 0;">
      <tr>
        <td align="center">

          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:#ffffff; border-radius:8px; padding:40px;">

            <tr>
              <td align="center" style="padding-bottom:20px;">
                <h1 style="margin:0; font-size:24px; color:#111827;">
                  Reset your password
                </h1>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-bottom:20px;">
                <p style="margin:0; font-size:14px; color:#4b5563; line-height:1.5;">
                  We received a request to reset your Riimo password. Use the link below to choose a new password.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:30px 0;">
                <a
                  href="${resetUrl}"
                  target="_blank"
                  style="
                    background-color:#2a54ea;
                    color:#ffffff;
                    padding:12px 20px;
                    text-decoration:none;
                    border-radius:6px;
                    font-size:14px;
                    display:inline-block;
                  "
                >
                  Reset password
                </a>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-bottom:20px;">
                <p style="margin:0; font-size:13px; color:#6b7280; line-height:1.5;">
                  If you did not request a password reset, you can safely ignore this email.
                  Your password will not change until you use the link above.
                </p>
              </td>
            </tr>

            <tr>
              <td style="border-top:1px solid #e5e7eb; padding-top:20px;"></td>
            </tr>

            <tr>
              <td align="center">
                <p style="margin:0; font-size:12px; color:#9ca3af;">
                  © 2026 Riimo. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
</html>
`;
