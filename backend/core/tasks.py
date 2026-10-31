"""
Core Celery tasks.
"""
from celery import shared_task
from django.core.management import call_command
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def cleanup_expired_sessions(self):
    """
    Clean up expired sessions from database.
    """
    try:
        call_command('clearsessions')
        logger.info("Successfully cleaned up expired sessions")
    except Exception as exc:
        logger.error(f"Failed to cleanup sessions: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task
def send_email_task(subject, message, recipient_list, from_email=None):
    """
    Send email asynchronously.
    """
    from django.core.mail import send_mail
    from django.conf import settings
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email or settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=False,
        )
        logger.info(f"Email sent to {recipient_list}")
    except Exception as exc:
        logger.error(f"Failed to send email: {exc}")
        raise


@shared_task(bind=True, max_retries=3)
def send_verification_email(self, user_id):
    """
    Send email verification using Resend HTTP API (bypasses SMTP port blocks on Render).
    """
    from django.contrib.auth import get_user_model
    from django.template.loader import render_to_string
    from django.conf import settings
    import urllib.request
    import json as json_lib

    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(f"send_verification_email: user {user_id} not found")
        return


    try:
        html_content = render_to_string('emails/verify_email.html', {
            'username': user.username,
            'verification_code': user.email_verification_token,
        })
    except Exception as exc:
        logger.error(f"❌ Failed to render email template: {exc}", exc_info=True)
        raise

    text_content = (
        f"Hola {user.username},\n\n"
        f"Tu código de verificación de lightcode es:\n\n"
        f"  {user.email_verification_token}\n\n"
        f"Ingresalo en la pantalla de verificación. Expira en 15 minutos.\n\n"
        f"Si no creaste una cuenta, ignorá este email."
    )

    # Intentar con Resend HTTP API primero (funciona en Render sin bloqueo de puertos)
    api_key = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    if api_key and api_key.startswith('re_'):
        try:
            # Usar dominio verificado de lightcode
            from_email = 'noreply@lightcodehub.com'

            payload = json_lib.dumps({
                "from": f"lightcode <{from_email}>",
                "to": [user.email],
                "subject": "Verifica tu email — lightcode",
                "html": html_content,
                "text": text_content,
            }).encode('utf-8')

            logger.info(f"Sending via Resend API from: lightcode <{from_email}> to: {user.email}")

            req = urllib.request.Request(
                'https://api.resend.com/emails',
                data=payload,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'User-Agent': 'lightcode/1.0',
                },
                method='POST'
            )
            try:
                with urllib.request.urlopen(req, timeout=15) as response:
                    result = json_lib.loads(response.read())
                    logger.info(f"✅ Verification email sent via Resend API to {user.email} (id: {result.get('id')})")
                    return
            except urllib.error.HTTPError as http_err:
                error_body = http_err.read().decode('utf-8')
                logger.error(f"Resend API HTTP {http_err.code}: {error_body}")
                raise Exception(f"HTTP Error {http_err.code}: {error_body}")
        except Exception as exc:
            logger.warning(f"Resend API failed, falling back to SMTP: {exc}")

    # Fallback: SMTP estándar
    try:
        from django.core.mail import EmailMultiAlternatives
        msg = EmailMultiAlternatives(
            subject="Verifica tu email — lightcode",
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        msg.attach_alternative(html_content, "text/html")
        result = msg.send(fail_silently=False)
        logger.info(f"✅ Verification email sent via SMTP to {user.email} (result: {result})")
    except Exception as exc:
        logger.error(f"❌ Failed to send verification email to {user.email}: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@shared_task
def invalidate_cache_pattern(pattern):
    """
    Invalidate cache keys matching a pattern.
    """
    try:
        cache.delete_pattern(pattern)
        logger.info(f"Invalidated cache pattern: {pattern}")
    except Exception as exc:
        logger.error(f"Failed to invalidate cache: {exc}")
