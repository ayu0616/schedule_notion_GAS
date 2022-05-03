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

type NotionQueryPayload = {};

type NotionPageProperties = {
	何を: { title: { text: { content: string } }[] };
	いつ: { date: { start: string; end: string } };
	終わった: { checkbox: boolean };
	どんな: { multi_select: { name: string }[] };
	ID: { rich_text: { type: "text"; text: { content: string } }[] };
};

type NotionPage = {
	object: string;
	id: string;
	url: string;
	properties: NotionPageProperties;
	created_time: string;
};

interface TaskMembers {
	title: string;
	tags: string[];
	startTime: Date;
	endTime: Date;
	isCompleted: boolean;
	id: string;
}

class Task {
	title: string;
	tags: string[];
	startTime: Date;
	endTime: Date;
	isCompleted: boolean;
	id: string;
	isNewTask: boolean;
	private notionPage: NotionPage | undefined;
	private calendarEvent: GoogleAppsScript.Calendar.CalendarEvent | undefined;
	private createdTime: Date | undefined;

	constructor({ title, tags, startTime, endTime, isCompleted, id }: TaskMembers) {
		this.title = title;
		this.tags = tags;
		this.startTime = startTime;
		this.endTime = endTime;
		this.isCompleted = isCompleted;
		this.isNewTask = !id;
		this.id = this.isNewTask ? this.setNewId() : id;
	}

	setNotionPage(notionPage: NotionPage) {
		this.notionPage = notionPage;
	}
	getNotionPage() {
		if (this.notionPage) {
			return this.notionPage;
		} else {
			throw new Error("notionPage is undefined");
		}
	}

	setCalendarEvent(event: GoogleAppsScript.Calendar.CalendarEvent) {
		this.calendarEvent = event;
	}
	getCalendarEvent() {
		if (this.calendarEvent) {
			return this.calendarEvent;
		} else {
			throw new Error("calendarEvent is undefined");
		}
	}

	setCreatedTime() {
		if (this.notionPage) {
			this.createdTime = new Date(this.notionPage.created_time);
		}
		if (this.calendarEvent) {
			this.createdTime = new Date(<Date>this.calendarEvent.getDateCreated());
		}
	}
	getCreatedTime() {
		if (this.createdTime) {
			return this.createdTime;
		} else {
			throw new Error("createdTime is undefined");
		}
	}

	static fromNotion(notionPage: NotionPage) {
		const notionProps = notionPage.properties;
		const taskProps: TaskMembers = {
			title: notionProps.何を.title[0].text.content,
			tags: notionProps.どんな.multi_select.map((value) => value.name),
			startTime: new Date(notionProps.いつ.date.start),
			endTime: new Date(notionProps.いつ.date.end),
			isCompleted: notionProps.終わった.checkbox,
			id: notionProps.ID.rich_text[0].text.content,
		};
		const task = new Task(taskProps);
		task.setNotionPage(notionPage);
		return task;
	}

	static fromCalendar(event: GoogleAppsScript.Calendar.CalendarEvent) {
		const eventTitle = event.getTitle();
		const taskTitle = eventTitle.replace(COMPLETE_TEXT, "");
		const isCompleted = eventTitle.slice(0, COMPLETE_TEXT.length) === COMPLETE_TEXT;

		const eventDescArray = event.getDescription().split("\n");
		const tagParagraph = eventDescArray.find((value) => value[0] === "#");
		const tags = (() => {
			if (tagParagraph) {
				return tagParagraph.slice(1).replace(/\s+/g, "").split("#");
			} else {
				return [""];
			}
		})();
		const id = eventDescArray.find((value) => value.slice(0, 4) === "id: ");

		const taskProps: TaskMembers = {
			title: taskTitle,
			tags: tags,
			startTime: new Date(<Date>event.getStartTime()),
			endTime: new Date(<Date>event.getEndTime()),
			isCompleted: isCompleted,
			id: id ? id.replace(/^id: /, "") : "",
		};
		const task = new Task(taskProps);
		task.setCalendarEvent(event);
		return task;
	}

	setNewId() {
		const fromDate = new Date().getTime().toString(16);
		const random = new Array(5)
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

	getCalendarDesc() {
		const tagsDesc = this.tags.map((tag) => "#" + tag).join(" ");
		const idDesc = "id: " + this.id;
		return tagsDesc + "\n" + idDesc;
	}

	createNewEvent(cal: GoogleAppsScript.Calendar.Calendar) {
		const options = { description: this.getCalendarDesc() };
		const newEvent = cal.createEvent(
			this.title,
			this.startTime,
			this.endTime,
			options,
		);
		newEvent.addPopupReminder(0);
		newEvent.addPopupReminder(60);
		this.setCalendarEvent(newEvent)
		return newEvent;
	}
}

class TaskArray extends Array<Task> {
	constructor(tasks: Task[]) {
		super(...tasks);
	}

	static fromNotion(notionPages: NotionPage[]) {
		const tasks = notionPages.map((notionPage) => {
			return Task.fromNotion(notionPage);
		});
		return new TaskArray(tasks);
	}

	static fromCalendar(events: GoogleAppsScript.Calendar.CalendarEvent[]) {
		const tasks = events.map((event) => {
			return Task.fromCalendar(event);
		});
		return new TaskArray(tasks);
	}

	/**カレンダーから取得したタスクにNotionのページを追加する */
	addNotion(notionPages: NotionPage[]) {}

	/**Notionから取得したタスクにカレンダーのイベントを追加する */
	addCalendar(events: GoogleAppsScript.Calendar.CalendarEvent[]) {}

	getDuplicatedIdTasks() {
		const duplicatedIds = this.filter(
			(task) => {
				return this.filter((task2) => task.id === task2.id).length >= 2;
			},
		).map((task) => task.id);
		const duplicatedIdUnique = new Array(...new Set(duplicatedIds));
		const duplicatedIdTasks: TaskArray[] = [];
		duplicatedIdUnique.forEach(
			(id) => {
				const duplicatedIdTask = new TaskArray(
					this.filter((task) => task.id === id),
				);
				duplicatedIdTask.sort(
					(a, b) => {
						return a.startTime.getTime() - b.startTime.getTime();
					},
				);
				duplicatedIdTasks.push(duplicatedIdTask);
			},
		);
		return duplicatedIdTasks;
	}

	createNewEvents() {
		const cal = CalendarApp.getCalendarById(CAL_ID);
		const newEvents = this.map((task) => task.createNewEvent(cal));
	}
}

const queryNotionDatabase = (payload: NotionQueryPayload = {}) => {
	const url = `https://api.notion.com/v1/databases/${DB_ID}/query`;
	const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
		method: "post",
		headers: NOTION_HEADERS,
		payload: JSON.stringify(payload),
	};
	const res = UrlFetchApp.fetch(url, options);
	const resStr: string = res.toString();
	const resJson = JSON.parse(resStr);
	const pages: NotionPage[] = resJson["results"];
	return pages;
};

const getCalendarEvents = () => {
	const cal = CalendarApp.getCalendarById(CAL_ID);
	const zeroTime = new Date(0);
	const futureTime = new Date(2100, 0);
	const events = cal.getEvents(zeroTime, futureTime);
	return events;
};

const fromNotionToCalendar = () => {
	const notionPages = queryNotionDatabase();
	const tasks = TaskArray.fromNotion(notionPages);

	const newTasks = new TaskArray(tasks.filter((task) => task.isNewTask));

	const existTasks = new TaskArray(tasks.filter((task) => !task.isNewTask));
};

const test = () => {};
