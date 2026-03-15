from django.contrib import admin

# Register your models here.
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from .models import UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0
    verbose_name_plural = "Perfil"


class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]
    list_display = (
        "id",
        "username",
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
    )


admin.site.unregister(User)
admin.site.register(User, UserAdmin)
admin.site.register(UserProfile)
