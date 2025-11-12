import time

FAIL_THRESHOLD = 3
RESET_TIMEOUT = 30  # seconds

failure_count = 0
last_failure_time = None

def check_circuit():
    global failure_count, last_failure_time
    if failure_count >= FAIL_THRESHOLD:
        if time.time() - last_failure_time < RESET_TIMEOUT:
            raise Exception("Circuit open: SMTP temporarily disabled")
        else:
            failure_count = 0  # reset after timeout

def record_failure():
    global failure_count, last_failure_time
    failure_count += 1
    last_failure_time = time.time()
