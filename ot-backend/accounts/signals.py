from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(
            user=instance,
            defaults={
                "nombre_completo": instance.get_full_name() or instance.username,
                "role": UserProfile.Role.TECHNICIAN,
            },
        )


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_user_profile(sender, instance, **kwargs):
    UserProfile.objects.get_or_create(
        user=instance,
        defaults={
            "nombre_completo": instance.get_full_name() or instance.username,
            "role": UserProfile.Role.TECHNICIAN,
        },
    )
