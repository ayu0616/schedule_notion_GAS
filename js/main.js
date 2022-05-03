"use strict";
const NOTION_TOKEN = "secret_FAq57RVurbCK8ZmUu5mKeQ5crJho5agZzFGPgUyNJ2H";
const NOTION_API_VERSION = "2022-02-22";
const NOTION_HEADERS = {
    "Content-type": "application/json",
    Authorization: "Bearer " + NOTION_TOKEN,
    "Notion-Version": NOTION_API_VERSION,
};
const DB_ID = "693ffff5c6c44ff88d6cf0340b3e4656";
const CAL_ID = "16smce49s0iguq930dq7v55f6k@group.calendar.google.com";
const COMPLETE_TEXT = "【完了済み】";
class Task {
    // title;
    // tags;
    // startTime;
    // endTime;
    // isCompleted;
    // id;
    // isNewTask;
    // notionId;
    // calendarEvent;
    constructor({ title, tags, startTime, endTime, isCompleted, id }) {
        this.title = title;
        this.tags = tags;
        this.startTime = startTime;
        this.endTime = endTime;
        this.isCompleted = isCompleted;
        this.isNewTask = !id;
        this.id = this.isNewTask ? this.setNewId() : id;
    }
    setNotionId(id) {
        this.notionId = id;
    }
    getNotionId() {
        if (this.notionId) {
            return this.notionId;
        }
        else {
            throw new Error("notionId is undefined");
        }
    }
    setCalendarEvent(event) {
        this.calendarEvent = event;
    }
    getCalendarEvent() {
        if (this.calendarEvent) {
            return this.calendarEvent;
        }
        else {
            throw new Error("calendarEvent is undefined");
        }
    }
    static fromNotion(notionPage) {
        const notionProps = notionPage.properties;
        const taskProps = {
            title: notionProps.何を.title[0].text.content,
            tags: notionProps.どんな.multi_select.map((value) => value.name),
            startTime: new Date(notionProps.いつ.date.start),
            endTime: new Date(notionProps.いつ.date.end),
            isCompleted: notionProps.終わった.checkbox,
            id: notionProps.ID.rich_text[0].text.content,
        };
        const task = new Task(taskProps);
        task.setNotionId(notionPage.id);
        return task;
    }
    static fromCalendar(event) {
        const eventTitle = event.getTitle();
        const taskTitle = eventTitle.replace(COMPLETE_TEXT, "");
        const isCompleted = eventTitle.slice(0, COMPLETE_TEXT.length) === COMPLETE_TEXT;
        const eventDescArray = event.getDescription().split("\n");
        const tagParagraph = eventDescArray.find((value) => value[0] === "#");
        const tags = (() => {
            if (tagParagraph) {
                return tagParagraph.slice(1).replace(/\s+/g, "").split("#");
            }
            else {
                return [""];
            }
        })();
        const id = eventDescArray.find((value) => value.slice(0, 4) === "id: ");
        const taskProps = {
            title: taskTitle,
            tags: tags,
            startTime: new Date(event.getStartTime()),
            endTime: new Date(event.getEndTime()),
            isCompleted: isCompleted,
            id: id ? id.replace(/^id: /, "") : "",
        };
        const task = new Task(taskProps);
        task.setCalendarEvent(event);
        return task;
    }
    setNewId() {
        const fromDate = new Date().getTime().toString(16);
        const random = new Array(3)
            .fill("")
            .map(() => this.rand16())
            .join("");
        return fromDate + random;
    }
    rand16() {
        const randNum = Math.floor(Math.random() * 16);
        return randNum.toString(16);
    }
    isHasTag() {
        return Boolean(this.id.toString());
    }
}
const queryNotionDatabase = (payload = {}) => {
    const url = `https://api.notion.com/v1/databases/${DB_ID}/query`;
    const options = {
        method: "post",
        headers: NOTION_HEADERS,
        payload: JSON.stringify(payload),
    };
    const res = UrlFetchApp.fetch(url, options);
    const resStr = res.toString();
    const resJson = JSON.parse(resStr);
    const pages = resJson["results"];
    return pages;
};
const getEvents = () => {
    const cal = CalendarApp.getCalendarById(CAL_ID);
    const zeroTime = new Date(0);
    const futureTime = new Date(2100, 0);
    const events = cal.getEvents(zeroTime, futureTime);
    return events;
};
const test = () => {
    const cal = CalendarApp.getCalendarById(CAL_ID);
    const zeroTime = new Date(0);
    const futureTime = new Date(2100, 0);
    const events = cal.getEvents(zeroTime, futureTime);
    const eventSeries = events.map((event) => event.getEventSeries());
};
