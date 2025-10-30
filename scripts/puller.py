#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

RESULTS_URL = 'https://ctftime.org/api/v1/results/'
DATA_ROOT = Path(__file__).resolve().parent.parent
INPUT_PATH = DATA_ROOT / 'public' / 'output.json'
OUTPUT_PATH = DATA_ROOT / 'public' / 'per_ctf_weight.json'


def calculate_team_rating(
    team_points: float,
    best_points: float,
    team_place: int,
    total_teams: int,
    weight: float,
) -> float:
    if best_points <= 0 or team_points <= 0 or team_place <= 0 or total_teams <= 0 or weight <= 0:
        return 0.0

    points_coef = team_points / best_points
    place_coef = 1.0 / float(team_place)
    denominator = 1.0 / (1.0 + float(team_place) / float(total_teams))
    if denominator == 0:
        return 0.0
    return (points_coef + place_coef) * weight / denominator


def load_events(path: Path) -> List[Dict[str, Any]]:
    with path.open('r', encoding='utf-8') as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError('Expected a list of events in output.json')
    return data


def fetch_results(year: Optional[int] = None) -> Dict[str, Any]:
    url = RESULTS_URL if year is None else f'{RESULTS_URL}{year}/'
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
        raise RuntimeError(f'Failed to fetch results: {exc}') from exc
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise RuntimeError('Invalid JSON payload from CTFtime results endpoint') from exc
    if not isinstance(data, dict):
        raise ValueError('Unexpected results payload structure')
    return data


def parse_event_year(event: Dict[str, Any]) -> Optional[int]:
    start = event.get('start')
    if not isinstance(start, str):
        return None
    try:
        return datetime.fromisoformat(start).year
    except ValueError:
        return None


def collect_results(events: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    years = {parse_event_year(event) for event in events}
    years = {year for year in years if year is not None}
    payload: Dict[str, Any] = {}

    if not years:
        return fetch_results()

    for year in sorted(years):
        data = fetch_results(year)
        payload.update(data)

    return payload


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _best_points(scores: Iterable[Dict[str, Any]]) -> float:
    best = 0.0
    for score in scores:
        pts = _safe_float(score.get('points'))
        if pts is None:
            continue
        if pts > best:
            best = pts
    return best


def compute_event_weight(
    event: Dict[str, Any],
    event_results: Dict[str, Any],
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    scores = event_results.get('scores')
    if not isinstance(scores, list) or not scores:
        return None, 'no_results'

    rank = _safe_int(event.get('rank'))
    if rank is None or rank <= 0:
        return None, 'missing_rank'

    total_teams = len(scores)
    team_score = None
    for entry in scores:
        place = _safe_int(entry.get('place'))
        if place == rank:
            team_score = entry
            break
    if team_score is None:
        return None, 'team_not_found'

    team_points = _safe_float(team_score.get('points'))
    if team_points is None or team_points <= 0:
        return None, 'zero_points'

    best_points = _best_points(scores)
    if best_points <= 0:
        return None, 'best_points_zero'

    weight = _safe_float(event.get('weight')) or 0.0
    rating = calculate_team_rating(team_points, best_points, rank, total_teams, weight)

    return (
        {
            'id': event.get('id'),
            'title': event.get('title'),
            'ctftime_url': event.get('ctftime_url'),
            'team_id': team_score.get('team_id'),
            'team_rank': rank,
            'team_points': team_points,
            'best_points': best_points,
            'event_weight': weight,
            'total_teams': total_teams,
            'computed_weight': rating,
        },
        None,
    )


def main() -> None:
    events = load_events(INPUT_PATH)
    results = collect_results(events)

    computed: List[Dict[str, Any]] = []
    missing: List[Dict[str, Any]] = []

    for event in events:
        event_id = event.get('id')
        key = str(event_id)
        event_results = results.get(key)
        if not isinstance(event_results, dict):
            missing.append({'id': event_id, 'title': event.get('title'), 'reason': 'no_event_results'})
            continue
        result, error = compute_event_weight(event, event_results)
        if result:
            computed.append(result)
        else:
            missing.append({'id': event_id, 'title': event.get('title'), 'reason': error or 'unknown'})

    computed.sort(key=lambda item: item.get('computed_weight', 0), reverse=True)

    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'events': computed,
        'missing': missing,
        'total_events': len(events),
        'computed_events': len(computed),
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + '\n', encoding='utf-8')

    print(f'Wrote computed weights for {len(computed)} events to {OUTPUT_PATH}')
    if missing:
        print('Skipped events:')
        for entry in missing[:10]:
            print(f" - {entry.get('id')}: {entry.get('reason')}")
        if len(missing) > 10:
            print(f'   ... and {len(missing) - 10} more')


if __name__ == '__main__':
    main()
