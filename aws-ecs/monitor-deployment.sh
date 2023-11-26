#!/bin/bash

# This script monitors the status of a CodeDeploy deployment.

counterCurrentVersion=0
counterNewVersion=0
lbUrl=$1
currentVersionTag=$2
newVersionTag=$3

printTimeSeconds=$(date +%s)
calculatePercTimeSeconds=$(date +%s)

# Using curl to make a request to the LB
while true; do

    # update the current time
    currentTimeSeconds=$(date +%s)

    # make a request to the LB
    response=$(curl -s $lbUrl)

    if [[ $response == *"$currentVersionTag"* ]]; then
        counterCurrentVersion=$((counterCurrentVersion + 1))
    elif [[ $response == *"$newVersionTag"* ]]; then
        counterNewVersion=$((counterNewVersion + 1))
    else
        echo "Unexpected response: $response"
        exit 1
    fi

    printTimePassedSeconds=$((currentTimeSeconds - printTimeSeconds))
    calculatePercTimePassedSeconds=$((currentTimeSeconds - calculatePercTimeSeconds))

    # print the counters every 5 seconds cleanning the console (timePassedSeconds > 5)
    if [[ $printTimePassedSeconds -gt 4 ]]; then
        clear
        echo
        date
        echo "Last info refreshed "$printTimePassedSeconds"s ago"
        echo "Last % calculated "$calculatePercTimePassedSeconds"s ago"
        echo
        echo "Last minute info:"
        echo "- Current version: $counterCurrentVersion"
        echo "- New version: $counterNewVersion"
        echo
        echo "=> Requests % going to the new version: $percentNewVersion%"
        if [[ $consecutiveNewVersion -gt 0 ]]; then
            echo
            echo "=> 100% requests going to new version for $consecutiveNewVersion minutes"
        fi
        printTimeSeconds=$(date +%s)
    fi

    # every 1 minute, print the % of requests that are going to the new version
    if [[ $calculatePercTimePassedSeconds -gt 60 ]]; then

        calculatePercTimeSeconds=$(date +%s)

        # clean the console and print the date before printing the % of requests
        echo " -- "
        totalRequests=$((counterCurrentVersion + counterNewVersion))
        if [[ $totalRequests -eq 0 ]]; then
            echo "No requests received"
        else
            percentNewVersion=$((counterNewVersion * 100 / totalRequests))
        fi

        # clean the counters
        counterCurrentVersion=0
        counterNewVersion=0

        # if 100% of the requests are going to the new version 3 times in a row, exit
        if [[ $percentNewVersion -eq 100 ]]; then
            consecutiveNewVersion=$((consecutiveNewVersion + 1))
            if [[ $consecutiveNewVersion -eq 3 ]]; then
                echo " -==- "
                echo "100% of the requests are going to the new version for 3 minutes in a row"
                exit 0
            fi
        else
            consecutiveNewVersion=0
        fi
    fi

    # sleep for 1 second
    sleep 1

done
