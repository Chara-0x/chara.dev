#!/usr/bin/env python3
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_ENDPOINT = 'https://ctftime.org/api/v1/events/'
EVENT_LIMIT = 100
DATA_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = DATA_ROOT / 'public' / 'output.json'
PULLER_PATH = Path(__file__).resolve().parent / 'puller.py'


def fetch_events(start_ts: int, finish_ts: int, limit: int = EVENT_LIMIT) -> List[Dict[str, Any]]:
    url = f'{API_ENDPOINT}?limit={limit}&start={start_ts}&finish={finish_ts}'
    request = Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
        },
    )
    try:
        with urlopen(request, timeout=60) as response:
            payload = response.read()
    except (HTTPError, URLError) as exc:
        raise RuntimeError(f'Failed to fetch events from CTFtime: {exc}') from exc

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise RuntimeError('Unable to decode events response as JSON') from exc

    if not isinstance(data, list):
        raise ValueError('Unexpected response format from CTFtime events API')

    def parse_start(event: Dict[str, Any]) -> float:
        start_value = event.get('start')
        if not isinstance(start_value, str):
            return 0.0
        try:
            return datetime.fromisoformat(start_value).timestamp()
        except ValueError:
            return 0.0

    return sorted(data, key=parse_start)


def load_existing_events(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    with path.open('r', encoding='utf-8') as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return data
    raise ValueError('Existing output.json is not a list')


def event_identity(event: Dict[str, Any]) -> str:
    identifier = event.get('id')
    if isinstance(identifier, (int, str)) and str(identifier):
        return f'id:{identifier}'
    title = event.get('title') or ''
    start = event.get('start') or ''
    return f'fallback:{title}:{start}'


def prompt_user_selection(events: Iterable[Dict[str, Any]], existing_map: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    selections: List[Dict[str, Any]] = []
    print('Recent events (past 14 days):')
    print('----------------------------------------')
    for index, event in enumerate(events, start=1):
        start_iso = event.get('start')
        try:
            start_label = (
                datetime.fromisoformat(start_iso)
                .astimezone()
                .strftime('%Y-%m-%d %H:%M %Z')
                if isinstance(start_iso, str)
                else 'Unknown start'
            )
        except ValueError:
            start_label = start_iso or 'Unknown start'
        existing = existing_map.get(event_identity(event))
        existing_rank = existing.get('rank') if isinstance(existing, dict) else None
        status_parts = []
        if existing_rank:
            status_parts.append(f'already logged rank #{existing_rank}')
        weight = event.get('weight')
        if weight:
            status_parts.append(f'weight {weight}')
        participants = event.get('participants')
        if participants:
            status_parts.append(f'{participants} teams')
        status = f" ({'; '.join(status_parts)})" if status_parts else ''
        print(f"[{index:02}] {event.get('title', 'Untitled event')} • {start_label}{status}")

        while True:
            response = input("  Did you participate? [y/N/q] ").strip().lower()
            if response in {'q', 'quit'}:
                print('Stopping selection.')
                return selections
            if response in {'', 'n', 'no'}:
                break
            if response in {'y', 'yes'}:
                rank = prompt_for_rank(existing_rank)
                record = merge_event_data(existing, event)
                record['rank'] = rank
                selections.append(record)
                break
            print('  Please answer with y, n, or q.')
    return selections


def prompt_for_rank(existing_rank: Any = None) -> int:
    while True:
        default_hint = f' [{existing_rank}]' if existing_rank else ''
        response = input(f'    Enter your final rank{default_hint}: ').strip()
        if not response and existing_rank:
            try:
                rank = int(existing_rank)
                if rank > 0:
                    return rank
            except (TypeError, ValueError):
                pass
        try:
            rank = int(response)
        except ValueError:
            print('    Rank must be a positive integer.')
            continue
        if rank <= 0:
            print('    Rank must be greater than zero.')
            continue
        return rank


def merge_event_data(existing: Dict[str, Any], new_event: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(existing) if isinstance(existing, dict) else {}
    merged.update(new_event)
    # Preserve manually curated scoring information if present in existing entry.
    for key in ('team_points', 'best_points', 'participants', 'participant_count', 'total_teams'):
        if key in merged and merged[key] is not None:
            continue
        if isinstance(existing, dict) and key in existing:
            merged[key] = existing[key]
    return merged


def upsert_events(
    existing_events: List[Dict[str, Any]],
    new_records: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    record_map: Dict[str, Dict[str, Any]] = {}
    for entry in existing_events:
        record_map[event_identity(entry)] = entry
    for record in new_records:
        record_map[event_identity(record)] = record

    def parse_start(entry: Dict[str, Any]) -> float:
        start_value = entry.get('start')
        if not isinstance(start_value, str):
            return 0.0
        try:
            return datetime.fromisoformat(start_value).timestamp()
        except ValueError:
            return 0.0

    sorted_entries = sorted(record_map.values(), key=parse_start, reverse=True)
    return sorted_entries


def write_events(path: Path, events: List[Dict[str, Any]]) -> None:
    path.write_text(json.dumps(events, indent=4, ensure_ascii=False) + '\n', encoding='utf-8')


def run_puller() -> None:
    print('\nRunning puller to recompute weights...')
    subprocess.run(['python3', str(PULLER_PATH)], check=True)


def main() -> None:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=30)
    start_ts = int(start.timestamp())
    finish_ts = int(now.timestamp())

    events = fetch_events(start_ts, finish_ts)
    if not events:
        print('No events returned by CTFtime for the selected window.')
        return

    existing_events = load_existing_events(OUTPUT_PATH)
    existing_map = {event_identity(entry): entry for entry in existing_events}

    selected_records = prompt_user_selection(events, existing_map)
    if not selected_records:
        print('No events selected. Nothing to update.')
        return

    updated_events = upsert_events(existing_events, selected_records)
    write_events(OUTPUT_PATH, updated_events)
    print(f'\nUpdated {OUTPUT_PATH} with {len(selected_records)} event(s).')

    run_puller()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nAborted by user.')
