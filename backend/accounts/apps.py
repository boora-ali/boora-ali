from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        from django.contrib.auth.models import Group, User
        from simple_history import register
        from simple_history.exceptions import MultipleRegistrationsError

        import accounts.signals  # noqa: F401

        for model in (User, Group):
            try:
                register(model, app=self.name)
            except MultipleRegistrationsError:
                pass
