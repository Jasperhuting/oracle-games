#!/usr/bin/env python3
"""
Script to verify and analyze riders only in main rankings
"""

import re
import os

def extract_points_from_html(html_content):
    """Extract rider ID and points from HTML content"""
    points_data = {}
    
    # Pattern for main rankings.html (extract data-rider-id and points)
    pattern_main = r'data-rider-id="([^"]+)".*?<div class="font-medium text-gray-900">(\d+)</div>'
    
    # Pattern for PCS files (extract rider URL and points)
    pattern_pcs = r'<tr class=""><td>\d+</td>.*?<a href="rider/([^"]+)">[^<]+</a>.*?<a href="rider\.php[^>]*>(\d+)</a></td></tr>'
    
    # Try main pattern first
    matches = re.findall(pattern_main, html_content, re.DOTALL)
    
    if matches:
        for match in matches:
            rider_id, points = match
            points_data[rider_id] = int(points)
    else:
        # Try PCS pattern
        matches = re.findall(pattern_pcs, html_content)
        for match in matches:
            rider_id, points = match
            points_data[rider_id] = int(points)
    
    return points_data

def read_file_content(filepath):
    """Read content from a file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"File not found: {filepath}")
        return ""
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return ""

def main():
    base_dir = "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games/app/api/games/[gameId]/teams-overview/"
    
    # Read main rankings.html
    print("Reading main rankings.html...")
    rankings_html = read_file_content(os.path.join(base_dir, "rankings.html"))
    main_points = extract_points_from_html(rankings_html)
    print(f"Extracted {len(main_points)} riders from main rankings")
    
    # Read all PCS files
    pcs_points = {}
    
    # PCS files from 1-300 (need to check what files exist)
    pcs_ranges = [
        "1-100", "101-200", "201-300"
    ]
    
    # Add the ranges we know exist
    for i in range(301, 1501, 100):
        pcs_ranges.append(f"{i}-{i+99}")
    
    print("Reading PCS ranking files...")
    for range_str in pcs_ranges:
        filename = f"rankings-pcs-{range_str}.html"
        filepath = os.path.join(base_dir, filename)
        
        if os.path.exists(filepath):
            html_content = read_file_content(filepath)
            file_points = extract_points_from_html(html_content)
            pcs_points.update(file_points)
            print(f"  {filename}: {len(file_points)} riders")
        else:
            print(f"  {filename}: not found")
    
    print(f"Total PCS riders: {len(pcs_points)}")
    
    # Find riders only in main rankings
    main_only = set(main_points.keys()) - set(pcs_points.keys())
    
    print(f"\n=== VERIFICATION: {len(main_only)} RIDERS ONLY IN MAIN RANKINGS ===")
    print("=" * 80)
    
    # Categorize by points
    zero_points = []
    low_points = []
    high_points = []
    
    for rider_id in sorted(main_only):
        points = main_points[rider_id]
        if points == 0:
            zero_points.append((rider_id, points))
        elif points < 50:
            low_points.append((rider_id, points))
        else:
            high_points.append((rider_id, points))
    
    print(f"Zero points (0): {len(zero_points)} riders")
    print(f"Low points (1-49): {len(low_points)} riders") 
    print(f"High points (50+): {len(high_points)} riders")
    print(f"Total: {len(zero_points) + len(low_points) + len(high_points)} riders")
    
    if low_points:
        print(f"\n=== LOW POINTS RIDERS ===")
        for rider_id, points in sorted(low_points, key=lambda x: x[1], reverse=True):
            print(f"ID: {rider_id} | Points: {points}")
    
    if high_points:
        print(f"\n=== HIGH POINTS RIDERS ===")
        for rider_id, points in sorted(high_points, key=lambda x: x[1], reverse=True):
            print(f"ID: {rider_id} | Points: {points}")
    
    # Verify the math
    print(f"\n=== MATHEMATICAL VERIFICATION ===")
    print(f"Main rankings total: {len(main_points)}")
    print(f"PCS rankings total: {len(pcs_points)}")
    print(f"Main only: {len(main_only)}")
    print(f"PCS only: {len(set(pcs_points.keys()) - set(main_points.keys()))}")
    print(f"Both: {len(set(main_points.keys()) & set(pcs_points.keys()))}")
    print(f"Check: {len(main_only) + len(set(pcs_points.keys()) - set(main_points.keys())) + len(set(main_points.keys()) & set(pcs_points.keys()))} = {len(main_only) + len(set(pcs_points.keys()) - set(main_points.keys())) + len(set(main_points.keys()) & set(pcs_points.keys()))}")

if __name__ == "__main__":
    main()
