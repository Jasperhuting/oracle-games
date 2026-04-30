#!/usr/bin/env python3
"""
Script to show riders that are only in main rankings.html but not in PCS files
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
    
    print(f"\n=== RIDERS ONLY IN MAIN RANKINGS ({len(main_only)} riders) ===")
    print("=" * 80)
    
    for rider_id in sorted(main_only):
        points = main_points[rider_id]
        print(f"ID: {rider_id} | Points: {points}")
    
    # Also check a few specific PCS files to see if these IDs might be there with different formatting
    print(f"\n=== DEBUGGING: Checking first few PCS files for these IDs ===")
    
    # Read first PCS file content to check for any of these IDs
    pcs_1_100_html = read_file_content(os.path.join(base_dir, "rankings-pcs-1-100.html"))
    
    for rider_id in list(main_only)[:5]:  # Check first 5
        if rider_id in pcs_1_100_html:
            print(f"Found {rider_id} in PCS 1-100 file!")
        else:
            print(f"{rider_id} not found in PCS 1-100 file")

if __name__ == "__main__":
    main()
