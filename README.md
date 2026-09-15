# Asyntai AI Chatbot data source for Grafana

Put your [Asyntai](https://asyntai.com) numbers on a Grafana dashboard, next to
everything else you already watch.

Asyntai is an AI chatbot that answers the visitors on your website. This data
source brings what it does into Grafana: how many people it talked to, what
they asked, who left an email address, and which tickets came out of it.

## What you can chart

| Show | Time series | Table |
| --- | --- | --- |
| Chats | Chats per hour or per day, split by source, country, category or website | Time, first question, message count, country, page, first reply time, hand over time |
| Leads | Leads per hour or per day | Time, email, phone, page, chat |
| Tickets | Tickets per hour or per day, split by status, priority or channel | Ticket number, subject, status, priority, who it is assigned to, first reply, resolved time |
| Messages of one chat | — | The whole conversation, message by message |

The plugin ships a ready dashboard called **Asyntai overview**. Import it from
the data source page and you have six panels without building anything.

## Install

1. Install the plugin from the Grafana plugin catalogue.
2. Open **Connections**, then **Data sources**, then **Add new data source**,
   and choose **Asyntai AI Chatbot**.
3. Sign in to Asyntai, open **Settings**, then **API**, and copy your API key.
4. Paste the key into the **API key** box and press **Save & test**.

The API key needs the Asyntai Starter plan or higher.

## Build a panel

1. Add a panel and pick the Asyntai data source.
2. In **Show**, choose Chats, Leads, Tickets, or the messages of one chat.
3. In **As**, choose a time series for a graph or a table for a list.
4. In **Split by**, pick a second dimension, for example the country or the
   source of the chat.

The panel reads the time range at the top of the dashboard, so zooming the
dashboard zooms the numbers.

## Variables

Every text box accepts a Grafana variable, so one dashboard can serve many
websites. Put your website id in a variable and write `$website` in the
**Website** box.

## Links

- [Asyntai](https://asyntai.com)
- [Integration guide](https://asyntai.com/documentation/integrations/grafana/)
- [Asyntai API reference](https://asyntai.com/documentation/api/)
