from django.contrib.auth.hashers import Argon2PasswordHasher


class TunedArgon2PasswordHasher(Argon2PasswordHasher):
    # Tuned for 2 vCPU — ~150-250ms vs ~900ms default
    # Still secure: OWASP recommends time_cost>=1, memory_cost>=64MB
    time_cost = 2
    memory_cost = 65536  # 64 MB
    parallelism = 1
